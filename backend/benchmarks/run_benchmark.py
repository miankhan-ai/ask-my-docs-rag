"""
Benchmark harness: drive the live ``/query`` API and report latency/cost/cache.

Mirrors ``evals/run_evals.py`` (httpx streaming over SSE, markdown output). It
measures per-request total latency, time-to-first-token, estimated cost, and
the ``cached`` flag, then prints p50/p95/p99, throughput, mean cost/query, and
cache hit rate.

To produce a before/after (caches OFF vs ON) comparison, run two phases against
servers started with the corresponding env and save each phase's JSON, then
combine:

    # terminal 1 — caches OFF
    python -m benchmarks.run_benchmark --phase off --out off.json
    # restart server with EMBEDDING_CACHE_ENABLED=true ANSWER_CACHE_ENABLED=true
    python -m benchmarks.run_benchmark --phase on  --out on.json
    python -m benchmarks.run_benchmark --compare off.json on.json

A single ``--phase`` run also prints its own summary table.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path

import httpx

GOLDEN_SET_PATH = Path(__file__).parent.parent / "evals" / "golden_set.json"


def _load_workload(path: Path | None) -> list[str]:
    src = path or GOLDEN_SET_PATH
    data = json.loads(src.read_text())
    return [item["question"] for item in data]


async def _one_query(client: httpx.AsyncClient, base_url: str, question: str) -> dict:
    """Run one query, returning latency/ttft/cost/cached for it."""
    start = time.perf_counter()
    ttft: float | None = None
    cost = 0.0
    cached = False
    async with client.stream(
        "POST", f"{base_url}/query", json={"question": question}, timeout=120.0
    ) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.startswith("data: "):
                continue
            event = json.loads(line[6:])
            if event["type"] == "token" and ttft is None:
                ttft = (time.perf_counter() - start) * 1000.0
            elif event["type"] == "done":
                cost = event.get("cost_usd", 0.0)
                cached = event.get("cached", False)
    total = (time.perf_counter() - start) * 1000.0
    return {
        "total_ms": total,
        "ttft_ms": ttft if ttft is not None else total,
        "cost_usd": cost,
        "cached": cached,
    }


async def _run(
    base_url: str, workload: list[str], n_requests: int, concurrency: int
) -> dict:
    """Run ``n_requests`` (cycling the workload) at the given concurrency."""
    questions = [workload[i % len(workload)] for i in range(n_requests)]
    results: list[dict] = []
    wall_start = time.perf_counter()
    async with httpx.AsyncClient() as client:
        for i in range(0, len(questions), concurrency):
            batch = questions[i : i + concurrency]
            batch_results = await asyncio.gather(
                *(_one_query(client, base_url, q) for q in batch)
            )
            results.extend(batch_results)
    wall_s = time.perf_counter() - wall_start

    totals = [r["total_ms"] for r in results]
    ttfts = [r["ttft_ms"] for r in results]
    costs = [r["cost_usd"] for r in results]
    hits = sum(1 for r in results if r["cached"])

    def pct(values: list[float], p: float) -> float:
        if not values:
            return 0.0
        return statistics.quantiles(values, n=100)[min(p, 99) - 1] if len(values) > 1 else values[0]

    return {
        "n": len(results),
        "concurrency": concurrency,
        "p50_ms": round(statistics.median(totals), 1),
        "p95_ms": round(pct(totals, 95), 1),
        "p99_ms": round(pct(totals, 99), 1),
        "ttft_p50_ms": round(statistics.median(ttfts), 1),
        "throughput_rps": round(len(results) / wall_s, 2),
        "cost_per_query_usd": round(sum(costs) / len(costs), 6) if costs else 0.0,
        "cache_hit_rate": round(hits / len(results), 3) if results else 0.0,
    }


def _print_summary(label: str, r: dict) -> None:
    print(f"\n### Benchmark: {label}")
    print(f"- requests: {r['n']} (concurrency {r['concurrency']})")
    print("\n| Metric | Value |")
    print("|---|---|")
    print(f"| p50 latency | {r['p50_ms']} ms |")
    print(f"| p95 latency | {r['p95_ms']} ms |")
    print(f"| p99 latency | {r['p99_ms']} ms |")
    print(f"| TTFT p50 | {r['ttft_p50_ms']} ms |")
    print(f"| throughput | {r['throughput_rps']} req/s |")
    print(f"| cost/query | ${r['cost_per_query_usd']} |")
    print(f"| cache hit rate | {r['cache_hit_rate'] * 100:.0f}% |")


def _print_comparison(off: dict, on: dict) -> None:
    def delta(a: float, b: float) -> str:
        if a == 0:
            return "—"
        return f"{(b - a) / a * 100:+.0f}%"

    print("\n### Cache OFF vs ON\n")
    print("| Metric | Caches OFF | Caches ON | Delta |")
    print("|---|---|---|---|")
    rows = [
        ("p50 latency (ms)", "p50_ms"),
        ("p95 latency (ms)", "p95_ms"),
        ("p99 latency (ms)", "p99_ms"),
        ("TTFT p50 (ms)", "ttft_p50_ms"),
        ("throughput (req/s)", "throughput_rps"),
        ("cost/query (USD)", "cost_per_query_usd"),
        ("cache hit rate", "cache_hit_rate"),
    ]
    for label, key in rows:
        print(f"| {label} | {off[key]} | {on[key]} | {delta(off[key], on[key])} |")


def main() -> None:
    parser = argparse.ArgumentParser(description="RAG API benchmark")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--n-requests", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--workload", type=Path, default=None)
    parser.add_argument("--phase", choices=["off", "on"], default=None)
    parser.add_argument("--out", type=Path, default=None, help="write phase JSON")
    parser.add_argument(
        "--compare", nargs=2, type=Path, default=None, metavar=("OFF", "ON")
    )
    args = parser.parse_args()

    if args.compare:
        off = json.loads(args.compare[0].read_text())
        on = json.loads(args.compare[1].read_text())
        _print_comparison(off, on)
        return

    workload = _load_workload(args.workload)
    result = asyncio.run(
        _run(args.base_url, workload, args.n_requests, args.concurrency)
    )
    label = f"phase={args.phase}" if args.phase else "single run"
    _print_summary(label, result)
    if args.out:
        args.out.write_text(json.dumps(result, indent=2))
        print(f"\nWrote {args.out}")


if __name__ == "__main__":
    sys.exit(main())
