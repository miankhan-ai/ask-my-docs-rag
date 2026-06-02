"""
Answer generation with citation enforcement.

Pipeline
--------
build_prompt        : Inject reranked chunks into a grounded system prompt.
stream_generate     : Stream tokens from Groq, then emit a final ``done`` event
                      carrying citations and a citation-warning flag.
validate_citations  : Post-generation check that ``[N]`` markers map to real chunks.
"""

import json
import re
import time
from typing import Any, AsyncIterator

from groq import AsyncGroq

from app.config import settings
from app.observability.metrics import (
    LLM_COMPLETION_TOKENS,
    LLM_COST_USD,
    LLM_PROMPT_TOKENS,
    LLM_TOTAL,
    LLM_TTFT,
    stats,
)
from app.observability.timing import TimingSink


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate generation cost in USD from the configured price table."""
    return (
        prompt_tokens / 1000.0 * settings.llm_price_in_per_1k
        + completion_tokens / 1000.0 * settings.llm_price_out_per_1k
    )


def build_prompt(
    question: str,
    chunks: list[dict[str, Any]],
) -> tuple[str, str]:
    """Build ``(system_prompt, user_message)`` for Groq generation."""
    context_lines = []
    for i, chunk in enumerate(chunks, start=1):
        source = chunk.get("source", "unknown")
        page = chunk.get("page_number")
        page_str = f", page {page}" if page else ""
        context_lines.append(f"[{i}] (source: {source}{page_str})\n{chunk['text']}")

    context_block = "\n\n".join(context_lines)

    system_prompt = f"""You are a document assistant. Answer questions using ONLY the provided context.
Cite inline using [1], [2], etc. corresponding to the context passages numbered below.
If the context does not support an answer, respond with exactly:
"I don't have enough information to answer this from the provided documents."

CONTEXT:
{context_block}"""

    return system_prompt, question


def validate_citations(answer: str, chunks: list[dict[str, Any]]) -> bool:
    """Return ``True`` (citation_warning) if citations are invalid or missing.

    Warning cases:
    - Answer contains ``[N]`` where ``N > len(chunks)`` or ``N < 1``.
    - Answer has no citations but chunks were provided (the model failed to cite).
    """
    citation_numbers = [int(m) for m in re.findall(r"\[(\d+)\]", answer)]

    if chunks and not citation_numbers:
        return True

    if not chunks:
        return False

    for n in citation_numbers:
        if n < 1 or n > len(chunks):
            return True

    return False


async def _groq_stream(system_prompt: str, user_message: str):
    """Thin wrapper around the Groq streaming API (mockable in tests).

    Requests usage stats via ``stream_options`` when the installed SDK supports
    it; older SDKs reject the kwarg, in which case we retry without it and fall
    back to a heuristic token estimate.
    """
    client = AsyncGroq(api_key=settings.groq_api_key)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    try:
        stream = await client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )
    except TypeError:
        stream = await client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            stream=True,
        )
    async for chunk in stream:
        yield chunk


def _extract_usage(chunk: Any) -> tuple[int, int] | None:
    """Return ``(prompt_tokens, completion_tokens)`` from a usage-bearing chunk.

    Returns ``None`` when usage is absent or not numeric (e.g. mocked chunks),
    so callers fall back to a heuristic estimate.
    """
    usage = getattr(chunk, "usage", None)
    if usage is None:
        return None
    prompt = getattr(usage, "prompt_tokens", None)
    completion = getattr(usage, "completion_tokens", None)
    try:
        return int(prompt), int(completion)
    except (TypeError, ValueError):
        return None


def build_citations(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build the citation list emitted in the ``done`` event."""
    return [
        {
            "id": i + 1,
            "text": c["text"],
            "source": c.get("source", "unknown"),
            "page": c.get("page_number"),
        }
        for i, c in enumerate(chunks)
    ]


async def stream_generate(
    question: str,
    chunks: list[dict[str, Any]],
    timings: TimingSink | None = None,
) -> AsyncIterator[str]:
    """Stream JSON event strings: ``token`` events, then a final ``done`` event.

    The ``done`` event additionally carries per-stage ``timings`` (if a sink is
    provided), token counts, and an estimated ``cost_usd`` for observability.
    """
    system_prompt, user_message = build_prompt(question=question, chunks=chunks)
    full_answer: list[str] = []

    start = time.perf_counter()
    ttft_ms: float | None = None
    usage: tuple[int, int] | None = None

    async for chunk in _groq_stream(system_prompt, user_message):
        # The terminal usage chunk (stream_options include_usage) has empty
        # choices but a populated ``usage`` field.
        found = _extract_usage(chunk)
        if found is not None:
            usage = found
        if not getattr(chunk, "choices", None):
            continue
        content = chunk.choices[0].delta.content
        if content is None:
            continue
        if ttft_ms is None:
            ttft_ms = (time.perf_counter() - start) * 1000.0
            LLM_TTFT.observe(ttft_ms / 1000.0)
        full_answer.append(content)
        yield json.dumps({"type": "token", "content": content})

    total_ms = (time.perf_counter() - start) * 1000.0
    LLM_TOTAL.observe(total_ms / 1000.0)
    if timings is not None:
        if ttft_ms is not None:
            timings.add("llm_ttft", ttft_ms)
        timings.add("llm_total", total_ms)

    answer = "".join(full_answer)
    citation_warning = validate_citations(answer=answer, chunks=chunks)
    citations = build_citations(chunks)

    # Token + cost accounting. Fall back to a word-count heuristic when the
    # provider did not return usage (e.g. mocked tests, older models).
    if usage is not None:
        prompt_tokens, completion_tokens = usage
    else:
        prompt_tokens = len(system_prompt.split()) + len(user_message.split())
        completion_tokens = len(answer.split())
    cost_usd = estimate_cost(prompt_tokens, completion_tokens)

    LLM_PROMPT_TOKENS.inc(prompt_tokens)
    LLM_COMPLETION_TOKENS.inc(completion_tokens)
    LLM_COST_USD.inc(cost_usd)
    stats.record_tokens(prompt_tokens, completion_tokens, cost_usd)

    yield json.dumps(
        {
            "type": "done",
            "citations": citations,
            "citation_warning": citation_warning,
            "timings": timings.as_dict() if timings is not None else {},
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": round(cost_usd, 6),
            "cached": False,
        }
    )
