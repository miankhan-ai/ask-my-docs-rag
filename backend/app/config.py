from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    hf_api_key: str
    hf_embedding_model: str = "BAAI/bge-large-en-v1.5"

    database_url: str

    bm25_top_n: int = 20
    dense_top_n: int = 20
    rrf_k: int = 60
    reranker_top_k: int = 5
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_batch_size: int = 100
    bm25_index_path: str = "data/bm25_index.pkl"


settings = Settings()
