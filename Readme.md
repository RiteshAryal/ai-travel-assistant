# AI Travel Assistant

## What is this?

A travel assistant that answers questions from **your own PDF travel guides**. Upload a guide (e.g. a London city guide), ask "Best places to visit in London", and get a streamed answer with page citations, grounded in the document rather than the LLM's guesswork. This is a RAG (Retrieval-Augmented Generation) app.

Stack: React (Vite + TypeScript) frontend, FastAPI backend, Qdrant vector store, OpenAI or local flan-t5 LLM.

Architecture diagram and purpose: [docs/architecture.md](docs/architecture.md).

## How the backend works

1. **Upload** (`POST /api/documents`): PDF is split into chunks, each chunk is turned into a vector by a local embedding model, and stored in Qdrant with its page number.
2. **Ask** (`POST /api/ask` or `/api/ask/stream`): the question is embedded, Qdrant returns the 5 most similar chunks, and the LLM answers using only those chunks.
3. **Stream**: the stream endpoint sends SSE events `sources`, then `token`s, then `done`.

The backend is stateless; chat history lives in the browser.

## Start the backend

From the repo root:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

- Pick one LLM via `MODEL_PROVIDER`: `gemini` (`GEMINI_API_KEY`, free tier), `openai` (`OPENAI_API_KEY`), `ollama` (local, no key; `OLLAMA_BASE_URL`, `OLLAMA_MODEL`) or `huggingface` (local flan-t5)
- `QDRANT_HOST=:memory:` for a zero-setup in-process Qdrant (data lost on restart), or your Qdrant Cloud URL + `QDRANT_API_KEY`

Run:

```bash
.venv/bin/uvicorn src.main:app --reload
```

Check: <http://localhost:8000/api/health>. First start downloads the embedding model, so it can take a minute.

## Start the frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Upload `data/paris-travel-guide.pdf` from the sidebar, then ask "Best places to visit in Paris".

## Tests

```bash
cd backend && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest
cd frontend && npm test
```