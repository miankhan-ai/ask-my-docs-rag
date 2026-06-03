"""
Structured JSON logging with request-scoped correlation IDs.

``configure_logging()`` wires structlog to emit one JSON object per log line
with an ISO timestamp, level, and any bound context. ``merge_contextvars``
pulls in the ``request_id`` bound by :class:`RequestContextMiddleware`, so every
log line emitted while handling a request carries its correlation ID — without
any business-logic code passing the ID around.
"""

from __future__ import annotations

import logging

import structlog

from app.config import settings

_configured = False


def configure_logging() -> None:
    """Configure structlog for JSON output. Idempotent."""
    global _configured
    if _configured:
        return

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", level=level)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )
    _configured = True


def get_logger(name: str | None = None) -> structlog.BoundLogger:
    """Return a structlog logger, configuring logging on first use."""
    if not _configured:
        configure_logging()
    return structlog.get_logger(name)
