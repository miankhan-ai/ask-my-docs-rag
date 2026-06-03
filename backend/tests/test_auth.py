"""Tests for auth service: hashing, JWT, refresh token CRUD."""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    create_refresh_token,
)


def test_hash_and_verify_password():
    pw = "SuperSecret123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_create_and_decode_access_token():
    payload = {"sub": "user-uuid-123", "email": "test@example.com"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-uuid-123"
    assert decoded["email"] == "test@example.com"


def test_decode_expired_token_raises():
    from app.auth.service import TokenExpiredError
    payload = {"sub": "user-uuid-123"}
    token = create_access_token(payload, expires_delta=timedelta(seconds=-1))
    with pytest.raises(TokenExpiredError):
        decode_access_token(token)


def test_decode_invalid_token_raises():
    from app.auth.service import InvalidTokenError
    with pytest.raises(InvalidTokenError):
        decode_access_token("not.a.real.token")


def test_create_refresh_token_is_uuid():
    import uuid
    token = create_refresh_token()
    uuid.UUID(token)  # raises ValueError if not valid UUID
