from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    hf_api_key: str = ""
    hf_embedding_model: str = "BAAI/bge-large-en-v1.5"

    # Embedding backend: "api" (HuggingFace Inference API) or "local"
    # (compute on-device via sentence-transformers, no key/network needed).
    embedding_backend: str = "api"
    # Local sentence-transformers model. Defaults to the same BGE model so the
    # 1024-dim vectors match the pgvector column and the API backend.
    local_embedding_model: str = "BAAI/bge-large-en-v1.5"

    database_url: str = "postgresql+asyncpg://askdocs:askdocs@localhost:5432/askdocs"

    bm25_top_n: int = 20
    dense_top_n: int = 20
    rrf_k: int = 60
    reranker_top_k: int = 5
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_batch_size: int = 100
    bm25_index_path: str = "data/bm25_index.pkl"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
