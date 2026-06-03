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

    # --- CORS ---
    # Comma-separated list of allowed browser origins for the API. Defaults to
    # the local Vite dev server; in production set CORS_ALLOW_ORIGINS to the
    # deployed frontend origin(s), e.g. "https://askmydocs.miankhan.me".
    cors_allow_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse the comma-separated CORS origins into a list."""
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

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

    # --- Auth ---
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Google OAuth2
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    # After OAuth, backend redirects here with ?token=<access_token>
    frontend_auth_callback_url: str = "http://localhost:5173/auth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
