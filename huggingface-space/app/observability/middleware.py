"""
Request-context middleware: correlation IDs, metrics, and timing.

A single ASGI middleware is the one place that:
- assigns/propagates an ``X-Request-ID`` (generated if absent),
- binds it into structlog's contextvars so all logs in the request carry it,
- records request count / in-flight / latency into Prometheus + StatsCollector.

Keeping this here means endpoints and pipeline code stay free of cross-cutting
observability concerns.
"""

from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.observability.metrics import IN_FLIGHT, REQUEST_COUNT, stats


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Bind a request ID, time the request, and emit request metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )
        endpoint = request.url.path
        start = time.perf_counter()
        IN_FLIGHT.inc()
        stats.request_started()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            IN_FLIGHT.dec()
            REQUEST_COUNT.labels(endpoint=endpoint, status=str(status)).inc()
            stats.request_finished(status, elapsed_ms)
            structlog.contextvars.clear_contextvars()
