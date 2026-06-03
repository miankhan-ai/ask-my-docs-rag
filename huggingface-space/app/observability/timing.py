"""
Per-stage timing primitives.

``stage_timer`` (async) and ``stage_timer_sync`` are the single way pipeline
stages report their latency. Each records into the Prometheus ``STAGE_LATENCY``
histogram, the in-process ``StatsCollector``, an optional per-request
``TimingSink`` (so timings can be surfaced to the frontend), and a structlog
debug line — all from one ``with`` block, keeping business logic clean.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator, Iterator

from app.observability.logging import get_logger
from app.observability.metrics import STAGE_LATENCY, stats

logger = get_logger(__name__)


@dataclass
class TimingSink:
    """Collects ``{stage, elapsed_ms}`` entries for a single request."""

    entries: list[dict[str, float]] = field(default_factory=list)

    def add(self, stage: str, elapsed_ms: float) -> None:
        self.entries.append({"stage": stage, "elapsed_ms": round(elapsed_ms, 2)})

    def as_dict(self) -> dict[str, float]:
        """Flatten to ``{stage: ms}`` (last write wins for repeated stages)."""
        return {e["stage"]: e["elapsed_ms"] for e in self.entries}


def _record(stage: str, elapsed_ms: float, sink: TimingSink | None) -> None:
    STAGE_LATENCY.labels(stage=stage).observe(elapsed_ms / 1000.0)
    stats.record_stage(stage, elapsed_ms)
    if sink is not None:
        sink.add(stage, elapsed_ms)
    logger.debug("stage_complete", stage=stage, elapsed_ms=round(elapsed_ms, 2))


@asynccontextmanager
async def stage_timer(
    stage: str, sink: TimingSink | None = None
) -> AsyncIterator[None]:
    """Async context manager timing a pipeline stage."""
    start = time.perf_counter()
    try:
        yield
    finally:
        _record(stage, (time.perf_counter() - start) * 1000.0, sink)


@contextmanager
def stage_timer_sync(stage: str, sink: TimingSink | None = None) -> Iterator[None]:
    """Synchronous sibling of :func:`stage_timer` (e.g. for the reranker)."""
    start = time.perf_counter()
    try:
        yield
    finally:
        _record(stage, (time.perf_counter() - start) * 1000.0, sink)
