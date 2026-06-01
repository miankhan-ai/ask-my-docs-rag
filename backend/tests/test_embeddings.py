import pytest
from unittest.mock import AsyncMock, patch

from app import embeddings


async def test_embed_texts_uses_api_backend():
    with patch.object(embeddings.settings, "embedding_backend", "api"):
        with patch("app.embeddings._embed_via_api", new_callable=AsyncMock) as mock_api:
            mock_api.return_value = [[0.1] * 1024]
            result = await embeddings.embed_texts(["hello"])
    mock_api.assert_awaited_once()
    assert result == [[0.1] * 1024]


async def test_embed_texts_uses_local_backend():
    with patch.object(embeddings.settings, "embedding_backend", "local"):
        with patch("app.embeddings._embed_via_local", new_callable=AsyncMock) as mock_local:
            mock_local.return_value = [[0.2] * 1024]
            result = await embeddings.embed_texts(["hello"])
    mock_local.assert_awaited_once()
    assert result == [[0.2] * 1024]


async def test_embed_one_returns_single_vector():
    with patch("app.embeddings.embed_texts", new_callable=AsyncMock) as mock_texts:
        mock_texts.return_value = [[0.3] * 1024]
        result = await embeddings.embed_one("hello")
    assert result == [0.3] * 1024
