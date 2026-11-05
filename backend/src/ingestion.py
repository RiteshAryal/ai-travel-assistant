"""Write path of the RAG pipeline: turn an uploaded PDF into searchable vectors.

    PDF bytes -> text per page (PyMuPDF) -> chunks of ~500 chars (100 overlap)
              -> one embedding per chunk -> stored in Qdrant with text/page/source

Called by POST /api/documents in main.py. The read path is retrieval.py + generation.py.
"""
import logging
import time
from uuid import NAMESPACE_URL, uuid5

import pymupdf
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.core.config import settings
from src.core.embeddings import get_embeddings
from src.core.vectorstore import get_qdrant_client

logger = logging.getLogger(__name__)


def chunk_id(source: str, page: int, index: int) -> str:
    """Return a stable UUID for one chunk, derived from file name, page and chunk position.

    Same input always gives the same ID, so re-uploading a file overwrites its old points
    instead of adding duplicates.
    """
    # Deterministic ID so re-uploading the same file overwrites its points instead of duplicating them
    return str(uuid5(NAMESPACE_URL, f"{source}:{page}:{index}"))


def ingest_pdf(content: bytes, filename: str) -> dict:
    """Split a PDF into chunks, embed them and upsert into Qdrant.

    Blocking (CPU-bound embedding); call from a worker thread.
    Raises ValueError for unreadable or text-less PDFs.
    Returns {"pages": int, "chunks": int, "timings": {extract_ms, chunk_ms, embed_ms, store_ms}}.
    """
    logger.info("Processing PDF file: %s", filename)
    started = time.perf_counter()

    # Load PDF directly from memory
    try:
        pdf = pymupdf.open(stream=content, filetype="pdf")
    except Exception as e:
        raise ValueError("File is not a valid PDF") from e

    # 1) Extract: one Document per page, remembering page number (0-based) and file name
    docs = []
    page_count = len(pdf)
    logger.info("PDF loaded, %d pages", page_count)

    try:
        for page_num in range(page_count):
            page = pdf[page_num]
            text = page.get_text()
            docs.append(Document(
                page_content=text,
                metadata={"page": page_num, "source": filename}
            ))
    finally:
        pdf.close()

    extracted = time.perf_counter()

    # 2) Chunk: pages are too long to embed well; ~500-char pieces keep one idea each.
    #    The 100-char overlap avoids cutting a sentence's meaning at a chunk border.
    logger.info("Splitting document into chunks")
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_documents(docs)
    logger.info("Created %d text chunks", len(chunks))

    chunked = time.perf_counter()

    # Scanned PDFs (images only) have no text layer, so there is nothing to index
    if not chunks:
        raise ValueError("No extractable text found in PDF")

    # 3) Embed: one vector per chunk (batch call is much faster than one by one)
    logger.info("Generating embeddings")
    texts = [chunk.page_content for chunk in chunks]
    embeddings = get_embeddings(texts)
    embedded = time.perf_counter()

    # Get the Qdrant client
    client = get_qdrant_client()

    # 4) Store: payload = what retrieval returns later (text for the prompt, page/source for citations)
    payloads = [{"text": chunk.page_content, **chunk.metadata} for chunk in chunks]
    ids = [chunk_id(filename, chunk.metadata["page"], i) for i, chunk in enumerate(chunks)]

    # Upload points
    logger.info("Uploading %d chunks to collection '%s'", len(chunks), settings.collection_name)
    client.upload_collection(
        collection_name=settings.collection_name,
        vectors=embeddings,
        payload=payloads,
        ids=ids,
    )
    logger.info("Upload complete: %d chunks from %d pages", len(chunks), page_count)

    stored = time.perf_counter()

    def ms(start: float, end: float) -> int:
        return round((end - start) * 1000)

    return {
        "pages": page_count,
        "chunks": len(chunks),
        "timings": {
            "extract_ms": ms(started, extracted),
            "chunk_ms": ms(extracted, chunked),
            "embed_ms": ms(chunked, embedded),
            "store_ms": ms(embedded, stored),
        },
    }
