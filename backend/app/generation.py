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
from typing import Any, AsyncIterator

from groq import AsyncGroq

from app.config import settings


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
    """Thin wrapper around the Groq streaming API (mockable in tests)."""
    client = AsyncGroq(api_key=settings.groq_api_key)
    stream = await client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        stream=True,
    )
    async for chunk in stream:
        yield chunk


async def stream_generate(
    question: str,
    chunks: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """Stream JSON event strings: ``token`` events, then a final ``done`` event."""
    system_prompt, user_message = build_prompt(question=question, chunks=chunks)
    full_answer: list[str] = []

    async for chunk in _groq_stream(system_prompt, user_message):
        content = chunk.choices[0].delta.content
        if content is None:
            break
        full_answer.append(content)
        yield json.dumps({"type": "token", "content": content})

    answer = "".join(full_answer)
    citation_warning = validate_citations(answer=answer, chunks=chunks)

    citations = [
        {
            "id": i + 1,
            "text": c["text"],
            "source": c.get("source", "unknown"),
            "page": c.get("page_number"),
        }
        for i, c in enumerate(chunks)
    ]
    yield json.dumps(
        {
            "type": "done",
            "citations": citations,
            "citation_warning": citation_warning,
        }
    )
