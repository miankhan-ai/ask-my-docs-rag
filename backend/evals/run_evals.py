"""Eval CLI: runs golden set against live API, scores metrics, exits 1 on threshold breach."""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

import httpx
from groq import AsyncGroq

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"
BASE_URL = "http://localhost:8000"


async def run_query(client: httpx.AsyncClient, question: str) -> tuple[str, list[dict]]:
    """Stream a query from the API; return ``(full_answer, citations)``."""
    async with client.stream(
        "POST",
        f"{BASE_URL}/query",
        json={"question": question},
        timeout=120.0,
    ) as resp:
        resp.raise_for_status()
        answer_tokens: list[str] = []
        citations: list[dict] = []
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                event = json.loads(line[6:])
                if event["type"] == "token":
                    answer_tokens.append(event["content"])
                elif event["type"] == "done":
                    citations = event["citations"]
        return "".join(answer_tokens), citations


def retrieval_recall_at_k(retrieved_sources: list[str], expected_sources: list[str]) -> float:
    """Fraction of expected sources found among the retrieved sources."""
    if not expected_sources:
        return 1.0
    retrieved_set = {s.lower() for s in retrieved_sources}
    hits = sum(1 for s in expected_sources if s.lower() in retrieved_set)
    return hits / len(expected_sources)


async def score_faithfulness(
    groq_client: AsyncGroq,
    model: str,
    answer: str,
    citations: list[dict],
) -> float:
    """Score each citation 0/1 for faithfulness; return the mean."""
    if not citations:
        return 1.0
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer) if s.strip()]
    scores: list[float] = []
    for citation in citations:
        relevant = [s for s in sentences if f"[{citation['id']}]" in s]
        if not relevant:
            continue
        sentence = " ".join(relevant)
        prompt = (
            f"Source passage: {citation['text']}\n"
            f"Answer sentence containing citation: {sentence}\n\n"
            "Is the claim in the sentence supported by the source passage? "
            "Respond with only '1' (supported) or '0' (not supported)."
        )
        resp = await groq_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=5,
        )
        score_text = resp.choices[0].message.content.strip()
        scores.append(1.0 if score_text == "1" else 0.0)
    return sum(scores) / len(scores) if scores else 1.0


async def score_correctness(
    groq_client: AsyncGroq,
    model: str,
    question: str,
    expected_answer: str,
    actual_answer: str,
) -> float:
    """Score the answer's correctness on a 1-5 scale."""
    prompt = (
        f"Question: {question}\n"
        f"Reference answer: {expected_answer}\n"
        f"AI answer: {actual_answer}\n\n"
        "Rate the AI answer from 1 to 5:\n"
        "5 = Complete, correct, no hallucination\n"
        "4 = Mostly correct, minor omissions\n"
        "3 = Partially correct, some errors\n"
        "2 = Major errors or significant missing info\n"
        "1 = Wrong or hallucinated\n\n"
        "Respond with only the integer score."
    )
    resp = await groq_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=5,
    )
    try:
        return float(resp.choices[0].message.content.strip())
    except ValueError:
        return 1.0


async def main(
    threshold_recall: float,
    threshold_faithfulness: float,
    threshold_correctness: float,
    groq_api_key: str,
    groq_model: str,
) -> bool:
    golden_set = json.loads(GOLDEN_SET_PATH.read_text())
    groq_client = AsyncGroq(api_key=groq_api_key)

    recall_scores, faithfulness_scores, correctness_scores = [], [], []

    async with httpx.AsyncClient() as http_client:
        for item in golden_set:
            print(f"  Evaluating: {item['id']} - {item['question'][:60]}...")
            answer, citations = await run_query(http_client, item["question"])
            retrieved_sources = [c["source"] for c in citations]

            recall = retrieval_recall_at_k(retrieved_sources, item["expected_source_docs"])
            faithfulness = await score_faithfulness(groq_client, groq_model, answer, citations)
            correctness = await score_correctness(
                groq_client, groq_model,
                item["question"], item["expected_answer"], answer,
            )
            recall_scores.append(recall)
            faithfulness_scores.append(faithfulness)
            correctness_scores.append(correctness)
            print(f"    recall={recall:.2f}  faithfulness={faithfulness:.2f}  correctness={correctness:.1f}")

    avg_recall = sum(recall_scores) / len(recall_scores)
    avg_faithfulness = sum(faithfulness_scores) / len(faithfulness_scores)
    avg_correctness = sum(correctness_scores) / len(correctness_scores)

    print("\n| Metric | Score | Threshold | Pass |")
    print("|---|---|---|---|")
    print(f"| Recall@k | {avg_recall:.3f} | {threshold_recall} | {'PASS' if avg_recall >= threshold_recall else 'FAIL'} |")
    print(f"| Faithfulness | {avg_faithfulness:.3f} | {threshold_faithfulness} | {'PASS' if avg_faithfulness >= threshold_faithfulness else 'FAIL'} |")
    print(f"| Correctness | {avg_correctness:.3f} | {threshold_correctness} | {'PASS' if avg_correctness >= threshold_correctness else 'FAIL'} |")

    return (
        avg_recall >= threshold_recall
        and avg_faithfulness >= threshold_faithfulness
        and avg_correctness >= threshold_correctness
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Ask My Docs evals")
    parser.add_argument("--threshold-recall", type=float, default=0.7)
    parser.add_argument("--threshold-faithfulness", type=float, default=0.8)
    parser.add_argument("--threshold-correctness", type=float, default=3.5)
    parser.add_argument("--groq-api-key", default=None)
    parser.add_argument("--groq-model", default="llama-3.3-70b-versatile")
    args = parser.parse_args()

    import os

    api_key = args.groq_api_key or os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        print("ERROR: GROQ_API_KEY required")
        sys.exit(1)

    passed = asyncio.run(
        main(
            args.threshold_recall,
            args.threshold_faithfulness,
            args.threshold_correctness,
            api_key,
            args.groq_model,
        )
    )
    sys.exit(0 if passed else 1)
