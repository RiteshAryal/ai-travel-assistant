"""HTTP entry point of the backend (FastAPI app).

Defines every route under /api and wires the other modules together:

    POST /api/documents  PDF  -> ingestion.py   (chunk, embed, store in Qdrant)
    POST /api/ask         question -> generation.py -> full JSON answer
    POST /api/ask/stream  question -> generation.py -> answer streamed as SSE events
    GET  /api/health      is Qdrant reachable?

Run with: uvicorn src.main:app --reload
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Annotated, Optional

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, StringConstraints

from src.core.config import settings
from src.core.embeddings import get_model
from src.core.logging_setup import setup_logging
from src.generation import generate_answer, get_qa_chain, stream_answer
from src.ingestion import ingest_pdf
from src.core.vectorstore import get_qdrant_client, init_qdrant

setup_logging()
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run once at server startup (code before `yield`) so problems surface at boot.

    Creates/validates the Qdrant collection and preloads the embedding model and the LLM
    chain, so the first user request is not slow and bad config fails immediately.
    """
    # Initialize Qdrant database
    logger.info("Initializing Qdrant database")
    init_qdrant()
    logger.info("Database initialization complete")
    # Load models up front so the first request is not slow and config errors fail at startup
    get_model()
    get_qa_chain()
    yield


app = FastAPI(lifespan=lifespan)
# CORS: lets the browser app (e.g. http://localhost:5173) call this API from another origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# All routes live under /api; the router is attached to the app at the bottom of the file
router = APIRouter(prefix="/api")


class QueryRequest(BaseModel):
    """Request body of /ask and /ask/stream: {"query": "..."}.

    The query is trimmed and must not be empty, otherwise FastAPI answers 422.
    """

    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def sse(event: str, data) -> str:
    """Format one Server-Sent Event: `event: <name>` + `data: <json>` + blank line.

    The blank line ends the event; the frontend parser (sse.ts) splits on it.
    """
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/health")
def health():
    """Liveness check. Returns {"status": "ok"|"degraded", "qdrant": bool}.

    "degraded" means the API is up but the vector database cannot be reached.
    """
    try:
        get_qdrant_client().get_collections()
        qdrant = True
    except Exception:
        qdrant = False
    return {"status": "ok" if qdrant else "degraded", "qdrant": qdrant}


@router.post("/ask")
def ask_question(req: QueryRequest):
    """Answer a question in one response: {"response": text, "sources": [chunks]}.

    Flow: retrieve top chunks from Qdrant -> LLM -> JSON. Errors become a generic 500
    (the real error is only in the server log, never leaked to the client).
    """
    # Sync def: FastAPI runs it in a threadpool so the blocking LLM call does not stall the event loop
    try:
        result = generate_answer(req.query)
    except Exception as e:
        logger.exception("Error answering question")
        raise HTTPException(status_code=500, detail="Error generating answer, see server logs")
    return {"response": result["answer"], "sources": result["sources"]}


@router.post("/ask/stream")
async def ask_stream(req: QueryRequest):
    """Answer a question as a stream of Server-Sent Events.

    Event order: `sources` once, then many `token` {"t": text}, then `done`.
    If something fails mid-stream, an `error` event is sent instead of `done`
    (the HTTP status is already 200 by then, so errors must travel inside the stream).
    """

    async def events():
        """Generator that turns stream_answer() output into SSE-formatted strings."""
        try:
            async for kind, data in stream_answer(req.query):
                if kind == "sources":
                    # Send only what the UI needs for citations, not the full chunk text
                    yield sse("sources", [
                        {"source": d["source"], "page": d["page"], "score": d["score"]} for d in data
                    ])
                else:
                    yield sse("token", {"t": data})
            yield sse("done", {})
        except Exception as e:
            logger.exception("Error streaming answer")
            yield sse("error", {"detail": "Error generating answer, see server logs"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # no-cache + X-Accel-Buffering stop browsers/proxies (nginx) from buffering the stream
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/documents")
async def index_document(file: Optional[UploadFile] = File(None)):
    """Accept a PDF (multipart field `file`), index it, return page/chunk counts.

    Errors: 400 no file / not a PDF / unreadable or text-less PDF, 413 too large, 500 other.
    """
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    # Read one byte more than the limit: enough to detect "too big" without loading a huge file
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit")

    try:
        # ingest_pdf is blocking and CPU-heavy; run it in a thread so other requests keep working
        result = await asyncio.to_thread(ingest_pdf, content, file.filename)
    except ValueError as e:
        # Raised by ingest_pdf for bad PDFs: the message is safe to show the user
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Error processing file")
        raise HTTPException(status_code=500, detail="Error processing file, see server logs")

    return {"message": "File processed successfully", "filename": file.filename, **result}


app.include_router(router)
