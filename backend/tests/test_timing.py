"""Tests for the timing instrumentation utilities."""

import asyncio

from app.observability.timing import TimingSink, stage_timer, stage_timer_sync
from app.observability.metrics import STAGE_LATENCY


def _hist_sum(stage: str) -> float:
    """Read the Prometheus histogram _sum for a stage label."""
    for metric in STAGE_LATENCY.collect():
        for sample in metric.samples:
            if sample.name.endswith("_sum") and sample.labels.get("stage") == stage:
                return sample.value
    return 0.0


async def test_stage_timer_records_into_sink():
    sink = TimingSink()
    async with stage_timer("unit_async", sink):
        await asyncio.sleep(0.001)
    d = sink.as_dict()
    assert "unit_async" in d
    assert d["unit_async"] >= 0.0


def test_stage_timer_sync_records_into_sink():
    sink = TimingSink()
    with stage_timer_sync("unit_sync", sink):
        sum(range(1000))
    assert "unit_sync" in sink.as_dict()


async def test_stage_timer_observes_histogram():
    before = _hist_sum("hist_stage")
    async with stage_timer("hist_stage"):
        await asyncio.sleep(0.001)
    after = _hist_sum("hist_stage")
    assert after > before


def test_timing_sink_as_dict_last_wins():
    sink = TimingSink()
    sink.add("a", 1.0)
    sink.add("a", 2.0)
    assert sink.as_dict()["a"] == 2.0
