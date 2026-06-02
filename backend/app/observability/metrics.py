"""
Prometheus metrics and a lightweight in-process ``StatsCollector``.

Two consumers are served from one source of truth:

- ``GET /metrics`` exposes the raw Prometheus exposition format (for scrapers).
- ``GET /stats`` returns a compact JSON snapshot derived from ``StatsCollector``
  for the live in-app dashboard (so the frontend never parses Prometheus text).

All metric objects are module-level singletons. Defining them at import time
can clash with uvicorn ``--reload`` (the process re-imports and Prometheus
raises ``Duplicated timeseries``); ``_counter`` / ``_histogram`` therefore fall
back to the already-registered collector instead of raising.
"""

from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Any

from prometheus_client import REGISTRY, Counter, Gauge, Histogram


# --------------------------------------------------------------------------- #
# Reload-safe metric factories
# --------------------------------------------------------------------------- #
def _get_existing(name: str) -> Any | None:
    """Return an already-registered collector by metric name, if present."""
    return getattr(REGISTRY, "_names_to_collectors", {}).get(name)


def _counter(name: str, doc: str, labelnames: tuple[str, ...] = ()) -> Counter:
    try:
        return Counter(name, doc, labelnames=labelnames)
    except ValueError:
        return _get_existing(name)  # type: ignore[return-value]


def _histogram(name: str, doc: str, labelnames: tuple[str, ...] = ()) -> Histogram:
    try:
        return Histogram(name, doc, labelnames=labelnames)
    except ValueError:
        return _get_existing(name)  # type: ignore[return-value]


def _gauge(name: str, doc: str) -> Gauge:
    try:
        return Gauge(name, doc)
    except ValueError:
        return _get_existing(name)  # type: ignore[return-value]


# --------------------------------------------------------------------------- #
# Metric objects
# --------------------------------------------------------------------------- #
REQUEST_COUNT = _counter(
    "rag_requests_total", "Total HTTP requests", ("endpoint", "status")
)
IN_FLIGHT = _gauge("rag_requests_in_flight", "In-flight HTTP requests")
STAGE_LATENCY = _histogram(
    "rag_stage_latency_seconds", "Per-stage pipeline latency", ("stage",)
)
LLM_TTFT = _histogram("rag_llm_ttft_seconds", "LLM time-to-first-token")
LLM_TOTAL = _histogram("rag_llm_total_seconds", "LLM total generation time")
LLM_PROMPT_TOKENS = _counter("rag_llm_prompt_tokens_total", "Prompt tokens consumed")
LLM_COMPLETION_TOKENS = _counter(
    "rag_llm_completion_tokens_total", "Completion tokens produced"
)
LLM_COST_USD = _counter("rag_llm_cost_usd_total", "Estimated LLM cost in USD")
CACHE_HITS = _counter("rag_cache_hits_total", "Cache hits", ("cache",))
CACHE_MISSES = _counter("rag_cache_misses_total", "Cache misses", ("cache",))


# --------------------------------------------------------------------------- #
# StatsCollector — rolling aggregates for the /stats dashboard endpoint
# --------------------------------------------------------------------------- #
class StatsCollector:
    """Thread-safe rolling aggregates for the live dashboard.

    Prometheus histograms are great for scraping but awkward to read back as
    instantaneous percentiles in-process. This collector keeps small bounded
    windows (recent request latencies, a 1-minute request-timestamp ring, and
    per-stage latency samples) so ``snapshot()`` can return clean numbers the
    frontend renders directly.
    """

    def __init__(self, window: int = 200) -> None:
        self._lock = Lock()
        self._start = time.time()
        self._request_latencies_ms: deque[float] = deque(maxlen=window)
        self._request_times: deque[float] = deque(maxlen=2000)
        self._stage_samples: dict[str, deque[float]] = {}
        self._window = window
        self.requests_total = 0
        self.errors_total = 0
        self.by_status: dict[str, int] = {}
        self.in_flight = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.cost_usd = 0.0
        self.cache: dict[str, dict[str, int]] = {
            "embedding": {"hits": 0, "misses": 0},
            "answer": {"hits": 0, "misses": 0},
        }

    # -- request lifecycle -------------------------------------------------- #
    def request_started(self) -> None:
        with self._lock:
            self.in_flight += 1

    def request_finished(self, status: int, latency_ms: float) -> None:
        with self._lock:
            self.in_flight = max(0, self.in_flight - 1)
            self.requests_total += 1
            bucket = f"{status // 100}xx"
            self.by_status[bucket] = self.by_status.get(bucket, 0) + 1
            if status >= 500:
                self.errors_total += 1
            self._request_latencies_ms.append(latency_ms)
            self._request_times.append(time.time())

    # -- pipeline + LLM ----------------------------------------------------- #
    def record_stage(self, stage: str, elapsed_ms: float) -> None:
        with self._lock:
            self._stage_samples.setdefault(stage, deque(maxlen=self._window)).append(
                elapsed_ms
            )

    def record_tokens(self, prompt: int, completion: int, cost_usd: float) -> None:
        with self._lock:
            self.prompt_tokens += prompt
            self.completion_tokens += completion
            self.cost_usd += cost_usd

    def record_cache(self, cache: str, hit: bool) -> None:
        with self._lock:
            entry = self.cache.setdefault(cache, {"hits": 0, "misses": 0})
            entry["hits" if hit else "misses"] += 1

    # -- read --------------------------------------------------------------- #
    @staticmethod
    def _percentile(values: list[float], pct: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        k = (len(ordered) - 1) * pct
        lo = int(k)
        hi = min(lo + 1, len(ordered) - 1)
        return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)

    def snapshot(self) -> dict[str, Any]:
        """Return a JSON-serializable view of current stats."""
        with self._lock:
            latencies = list(self._request_latencies_ms)
            now = time.time()
            rate_1m = sum(1 for t in self._request_times if now - t <= 60) / 60.0
            by_stage = {
                stage: round(sum(s) / len(s), 2) if s else 0.0
                for stage, s in self._stage_samples.items()
            }
            cache_view = {}
            for name, c in self.cache.items():
                total = c["hits"] + c["misses"]
                cache_view[name] = {
                    "hits": c["hits"],
                    "misses": c["misses"],
                    "hit_ratio": round(c["hits"] / total, 4) if total else 0.0,
                }
            return {
                "uptime_s": round(now - self._start, 1),
                "requests": {
                    "total": self.requests_total,
                    "by_status": dict(self.by_status),
                    "rate_1m": round(rate_1m, 3),
                    "in_flight": self.in_flight,
                    "errors": self.errors_total,
                },
                "latency_ms": {
                    "p50": round(self._percentile(latencies, 0.50), 2),
                    "p95": round(self._percentile(latencies, 0.95), 2),
                    "by_stage": by_stage,
                },
                "tokens": {
                    "prompt_total": self.prompt_tokens,
                    "completion_total": self.completion_tokens,
                },
                "cost_usd_total": round(self.cost_usd, 6),
                "cache": cache_view,
            }


# Module-level singleton consumed by middleware, timing, generation, and cache.
stats = StatsCollector()


def record_cache_event(cache: str, hit: bool) -> None:
    """Emit a cache hit/miss to both Prometheus and the StatsCollector."""
    (CACHE_HITS if hit else CACHE_MISSES).labels(cache=cache).inc()
    stats.record_cache(cache, hit)
