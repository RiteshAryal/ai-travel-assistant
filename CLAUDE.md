# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

RAG travel assistant. React SPA (`frontend/`, Vite + TS) -> FastAPI (`backend/`) -> Qdrant vector store + LLM (OpenAI, Gemini, Ollama or HF flan-t5). API contract: README "API" section and `docs/architecture.md`.

## Commands

```bash
# backend (run from backend/; imports use `src.` prefix)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn src.main:app --reload     # :8000
.venv/bin/python -m pytest                  # tests; single: -k test_name

# frontend
cd frontend
npm install
npm run dev        # :5173, proxies /api -> :8000
npm test           # vitest
npm run lint       # oxlint
npm run build      # tsc + vite build
```

Backend env (see `backend/.env.example`; `.env` in `backend/` or repo root): `QDRANT_HOST`, `QDRANT_API_KEY`, `COLLECTION_NAME`, `MODEL_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `CORS_ORIGINS`, `MAX_UPLOAD_MB`. `QDRANT_HOST=:memory:` runs an in-process Qdrant (no cloud needed, data lost on restart). Frontend: `VITE_API_URL` (empty in dev). `data/paris-travel-guide.pdf` is a sample PDF.

## Architecture

- `backend/src/main.py`: all routes under `/api`: `GET /health`, `POST /documents` (multipart `file`), `POST /ask` (`{query}` -> `{response, sources}`), `POST /ask/stream` (SSE events `sources`, `token` `{t}`, `done`, `error` `{detail}`). Errors are 4xx/5xx `{detail}`. Lifespan creates the collection and preloads models.
- `backend/src/ingestion.py`: sync `ingest_pdf(bytes, filename)` (called via `asyncio.to_thread`): PyMuPDF pages -> splitter (500/100) -> embeddings -> `upload_collection` with deterministic `uuid5(source:page:idx)` IDs, so re-uploading the same file overwrites rather than duplicates.
- `backend/src/retrieval.py`: `query_points` top 5, returns `{text, page, source, score}`. `page` is 0-based.
- `backend/src/generation.py`: `get_qa_chain()` (cached) = prompt | LLM; provider libraries imported lazily. `generate_answer` returns `{answer, sources}`; `stream_answer` async-yields `("sources", docs)` then `("token", str)`. `_to_text` normalises OpenAI message chunks vs HF strings.
- `backend/src/core/embeddings.py`: lazy cached SentenceTransformer from `EMBEDDING_MODEL` (384-dim). vector size is read from the model, and startup fails if the existing collection has a different size, so changing the model requires a new collection or `COLLECTION_NAME`.
- `frontend/src/api/client.ts`: all HTTP calls; upload uses XHR for progress, streaming uses fetch + `sse.ts` parser. `hooks/useChat.ts` + `chatReducer.ts` hold chat state (browser only; backend is stateless).

## Gotchas

- Backend tests (`backend/tests/conftest.py`) use in-memory Qdrant, a hashing fake embedder and `GenericFakeChatModel`; they never load real models or call OpenAI.
- `/ask` is a sync `def` on purpose (FastAPI threadpool); don't make it `async def` without making the chain call async.
- Deterministic IDs don't remove stale chunks if a same-named PDF shrinks; points from the earlier version past the new chunk count remain.
- No auth: don't expose the backend publicly.
