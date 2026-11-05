"""Retrieval step of RAG: find the PDF chunks most similar to a question.

The question is embedded with the same model used at upload time, then Qdrant returns
the nearest chunk vectors. Used by generation.py to build the LLM prompt context.
"""
import time

from src.core.config import settings
from src.core.embeddings import get_embedding_dim, get_embeddings
from src.core.vectorstore import get_qdrant_client


TRACE_TEXT_CHARS = 200


def retrieve_docs(query: str, top_k=5, trace: dict | None = None):
    """Return the top_k chunks as dicts with text, page, source and score.

    `score` is cosine similarity (higher = more relevant). `page` is 0-based.
    If a `trace` dict is passed it is filled with `embed` and `search` details
    (inputs, outputs, timings) for the UI's pipeline panel.
    """
    client = get_qdrant_client()

    # Same embedding model as ingestion, so question and chunks share one vector space
    started = time.perf_counter()
    query_vector = get_embeddings([query])[0]
    embedded = time.perf_counter()

    # Nearest-neighbour search; with_payload=True also returns the stored text/page/source
    result = client.query_points(
        collection_name=settings.collection_name,
        query=query_vector,
        limit=top_k,
        with_payload=True,
    )

    searched = time.perf_counter()

    # Flatten Qdrant point objects into plain dicts so callers do not depend on Qdrant types
    docs = [
        {
            "text": point.payload.get("text", ""),
            "page": point.payload.get("page"),
            "source": point.payload.get("source"),
            "score": point.score,
        }
        for point in result.points
    ]

    if trace is not None:
        trace["embed"] = {
            "model": settings.embedding_model,
            "dim": get_embedding_dim(),
            "query": query,
            "ms": round((embedded - started) * 1000),
        }
        trace["search"] = {
            "collection": settings.collection_name,
            "top_k": top_k,
            "hits": [
                {
                    "source": d["source"],
                    "page": d["page"],
                    "score": d["score"],
                    "text": d["text"][:TRACE_TEXT_CHARS],
                }
                for d in docs
            ],
            "ms": round((searched - embedded) * 1000),
        }
    return docs
