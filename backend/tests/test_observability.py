"""Tests for the observability endpoints and middleware."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


async def test_metrics_endpoint(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text
    assert "rag_requests_total" in body
    assert "rag_stage_latency_seconds" in body


async def test_stats_endpoint_shape(client):
    resp = await client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("uptime_s", "requests", "latency_ms", "tokens", "cost_usd_total", "cache"):
        assert key in data
    assert "p50" in data["latency_ms"] and "p95" in data["latency_ms"]
    assert "total" in data["requests"] and "in_flight" in data["requests"]


async def test_request_id_echoed(client):
    resp = await client.get("/health", headers={"X-Request-ID": "test-123"})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID") == "test-123"


async def test_request_id_generated_when_absent(client):
    resp = await client.get("/health")
    assert resp.headers.get("X-Request-ID")  # non-empty
