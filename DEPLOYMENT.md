# Deployment Guide

Ask My Docs is a full-stack app split into two deployable parts:

| Part | What it is | Where it's hosted |
|---|---|---|
| **Frontend** | React/Vite static site (landing + marketing pages + app UI) | **Hostinger** at `https://askmydocs.miankhan.me` |
| **Backend** | FastAPI + ML models (retrieval, reranking, generation) | **Hugging Face Spaces** (free Docker Space) |

The frontend (static) calls the backend (HF Space) over HTTPS. This guide walks
through both, in order.

## Status

- ✅ **Backend LIVE:** https://miankhanai-ask-my-docs-backend.hf.space
  (Space: https://huggingface.co/spaces/miankhanai/ask-my-docs-backend) —
  `CORS_ALLOW_ORIGINS` is set. **Still TODO:** add your `GROQ_API_KEY` secret in
  the Space settings so generation works (see §1.3).
- ⏳ **Frontend:** GitHub Action + `VITE_API_BASE` variable are configured. **Still
  TODO:** add the 3 Hostinger FTP secrets to GitHub, then run the deploy (see §2).

---

## Part 1 — Deploy the backend to Hugging Face Spaces

The backend needs Python + ~1 GB RAM for the ML models, so it runs on a free HF
**Docker** Space. The files live in [`huggingface-space/`](huggingface-space/).

### 1.1 Create the Space
1. Go to https://huggingface.co/new-space
2. **Owner:** your account · **Space name:** `ask-my-docs-backend`
3. **License:** MIT (or your choice)
4. **SDK:** select **Docker** → **Blank**
5. **Hardware:** **CPU basic (free)** · **Visibility:** Public
6. Click **Create Space**.

### 1.2 Push the backend code to the Space
The Space is its own git repo. From the project root:

```bash
# One-time: build the Space folder contents (Dockerfile + README + backend app)
# Copy the backend app + evals next to the Space Dockerfile:
cp -r backend/app backend/requirements.txt backend/evals huggingface-space/

cd huggingface-space
git init
git add .
git commit -m "Ask My Docs backend"
git remote add space https://huggingface.co/spaces/<your-username>/ask-my-docs-backend
git push --force space main
```

> Replace `<your-username>`. When prompted for a password, use a Hugging Face
> **access token** (https://huggingface.co/settings/tokens, role: *write*).

The Space will now build the Docker image (first build takes ~5–10 min because it
pre-downloads the ML models). Watch the **Logs** tab until it says *Running*.

### 1.3 Configure the Space (Settings → Variables and secrets)
- **Secret** `GROQ_API_KEY` = your Groq API key (get one free at https://console.groq.com).
- **Variable** `CORS_ALLOW_ORIGINS` = `https://askmydocs.miankhan.me`

Restart the Space after setting these.

### 1.4 Note the Space URL
Your API is now at:

```
https://miankhanai-ask-my-docs-backend.hf.space
```

Test it: open `https://miankhanai-ask-my-docs-backend.hf.space/health` —
you should see `{"status":"ok"}`.

> **Free-tier note:** the Space filesystem is ephemeral (uploads + DB reset on
> restart) and the Space sleeps after inactivity (first request after sleep is
> slow while it wakes). Fine for a demo. For persistence, add Space persistent
> storage and set `DATABASE_URL_OVERRIDE=sqlite+aiosqlite:////data/askdocs.db`
> and `BM25_INDEX_PATH=/data/bm25_index.pkl`.

---

## Part 2 — Deploy the frontend to Hostinger

The frontend is a static build. Point it at the Space URL, build, and upload.

### Option A — Auto-deploy via GitHub Actions (recommended)

A workflow at [`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml)
builds the site and uploads it to Hostinger via FTP on every push.

1. In Hostinger **hPanel → Files → FTP Accounts**, note/create:
   - FTP host (e.g. `ftp.miankhan.me` or the server IP)
   - FTP username + password
   - The web root for the subdomain (e.g. `/public_html/` or
     `/domains/miankhan.me/public_html/askmydocs/`)
2. In GitHub **repo → Settings → Secrets and variables → Actions**, add:
   - Secret **`FTP_SERVER`**, **`FTP_USERNAME`**, **`FTP_PASSWORD`**
   - Variable **`VITE_API_BASE`** = `https://miankhanai-ask-my-docs-backend.hf.space`
3. In the workflow, set `server-dir:` to your subdomain's web root.
4. Push to `master` (or run the workflow manually from the **Actions** tab).
   It builds and uploads `frontend/dist/` to Hostinger.

### Option B — Manual build + upload

```bash
cd frontend
cp .env.production.example .env.production
# edit .env.production: set VITE_API_BASE to your HF Space URL
npm install
npm run build
```

This produces `frontend/dist/`. Upload **the contents of `dist/`** (not the
folder itself) to your subdomain's web root via:
- **hPanel → File Manager** → navigate to the `askmydocs` web root → upload +
  extract a zip of `dist/`'s contents, **or**
- any FTP client (FileZilla) to the same folder.

The included `.htaccess` (copied into `dist/`) handles SPA deep-link routing and
asset caching.

### Subdomain setup (one-time)
In **hPanel → Domains → Subdomains**, create `askmydocs` under `miankhan.me`.
Note the document root it assigns — that's where the `dist/` contents go (and the
`server-dir` for the GitHub Action).

---

## Verify the full deployment

1. Visit `https://askmydocs.miankhan.me` → landing page + all marketing pages load.
2. Click **Launch App** → `/app` loads. Direct-load `https://askmydocs.miankhan.me/app/dashboard`
   → no 404 (the `.htaccess` SPA fallback works).
3. Upload a document, ask a question → streamed answer with citations (this
   confirms the frontend ↔ HF Space ↔ Groq chain works and CORS is correct).

If chat fails with a CORS error in the browser console, double-check
`CORS_ALLOW_ORIGINS` on the Space exactly matches `https://askmydocs.miankhan.me`
(no trailing slash) and restart the Space.
