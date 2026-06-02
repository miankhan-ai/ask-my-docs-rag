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
    # Defaults to "local" so the app runs offline with no HF key.
    embedding_backend: str = "local"
    # Local sentence-transformers model. Defaults to a small, fast model
    # (~90 MB, 384-dim) for quick local testing. Swap to a larger model
    # (e.g. BAAI/bge-large-en-v1.5, 1024-dim) for higher quality.
    local_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    # Embedding dimension. MUST match the chosen embedding model's output
    # width and the pgvector column width when db_backend == "postgres".
    embedding_dim: int = 384

    # Storage backend: "postgres" (pgvector, production default) or "sqlite"
    # (zero-infra local mode — embeddings stored as JSON, dense search runs
    # in Python). The active database_url is derived from this below.
    db_backend: str = "sqlite"
    # Override the connection string explicitly if set; otherwise a sensible
    # default is chosen per db_backend (see ``database_url`` property).
    database_url_override: str = ""

    @property
    def database_url(self) -> str:
        """Resolve the active async database URL from the chosen backend."""
        if self.database_url_override:
            return self.database_url_override
        if self.db_backend == "sqlite":
            return "sqlite+aiosqlite:///data/askdocs.db"
        return "postgresql+asyncpg://askdocs:askdocs@localhost:5432/askdocs"

    bm25_top_n: int = 20
    dense_top_n: int = 20
    rrf_k: int = 60
    reranker_top_k: int = 5
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_batch_size: int = 100
    bm25_index_path: str = "data/bm25_index.pkl"

    # --- Observability ---
    log_level: str = "INFO"
    metrics_enabled: bool = True
    # LLM price table (USD per 1k tokens) for cost accounting. Groq's free
    # tier is $0, but this proves cost-awareness and is fully configurable.
    llm_price_in_per_1k: float = 0.00059
    llm_price_out_per_1k: float = 0.00079

    # --- Caching ---
    # Cache backend: "memory" (in-process LRU+TTL, zero-infra default) or
    # "redis" (opt-in, requires a running Redis at ``redis_url``).
    cache_backend: str = "memory"
    redis_url: str = "redis://localhost:6379/0"
    # Embedding cache: avoids recomputing embeddings for identical text.
    embedding_cache_enabled: bool = True
    embedding_cache_ttl_s: int = 86400
    embedding_cache_max_size: int = 10000
    # Semantic answer cache: returns a cached answer when a new query is within
    # ``answer_cache_similarity_threshold`` cosine of a previously seen query.
    # OFF by default — it is correctness-sensitive and would make eval gating
    # non-deterministic. Cached payloads carry their original citations.
    answer_cache_enabled: bool = False
    answer_cache_ttl_s: int = 3600
    answer_cache_max_size: int = 1000
    answer_cache_similarity_threshold: float = 0.95


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
