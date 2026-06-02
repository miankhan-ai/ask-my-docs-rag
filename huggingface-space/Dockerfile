# Hugging Face Spaces (Docker SDK) image for the Ask My Docs backend.
#
# HF Spaces requirements handled here:
#  - The app must listen on port 7860.
#  - The container runs as a non-root user (uid 1000); only $HOME, /data and
#    /tmp are writable. We point all caches + app data at writable locations.
#  - ML model weights are pre-downloaded at build time so the Space boots fast.
FROM python:3.12-slim

# System deps for building some Python wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (HF Spaces convention).
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Writable cache + data locations (HF Spaces filesystem is read-only except
# $HOME, /data, /tmp). These env vars are read by the app's config.
ENV HF_HOME=/home/user/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/home/user/.cache/sentence-transformers \
    TRANSFORMERS_CACHE=/home/user/.cache/huggingface \
    DATABASE_URL_OVERRIDE=sqlite+aiosqlite:////tmp/askdocs.db \
    BM25_INDEX_PATH=/tmp/bm25_index.pkl \
    EMBEDDING_BACKEND=local \
    DB_BACKEND=sqlite \
    PORT=7860

WORKDIR /home/user/app

# Install Python dependencies first (better layer caching).
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download the embedding + reranker models so the first request is fast.
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Copy the application code.
COPY --chown=user app ./app
COPY --chown=user evals ./evals

# HF Spaces routes external traffic to port 7860.
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
