"""Retrieval step of RAG: find the PDF chunks most similar to a question.

The question is embedded with the same model used at upload time, then Qdrant returns
the nearest chunk vectors. Used by generation.py to build the LLM prompt context.
"""
from src.core.config import settings
from src.core.embeddings import get_embeddings
from src.core.vectorstore import get_qdrant_client


def retrieve_docs(query: str, top_k=5):
    """Return the top_k chunks as dicts with text, page, source and score.

    `score` is cosine similarity (higher = more relevant). `page` is 0-based.
    """
    client = get_qdrant_client()

    # Same embedding model as ingestion, so question and chunks share one vector space
    query_vector = get_embeddings([query])[0]

    # Nearest-neighbour search; with_payload=True also returns the stored text/page/source
    result = client.query_points(
        collection_name=settings.collection_name,
        query=query_vector,
        limit=top_k,
        with_payload=True,
    )

    # Flatten Qdrant point objects into plain dicts so callers do not depend on Qdrant types
    return [
        {
            "text": point.payload.get("text", ""),
            "page": point.payload.get("page"),
            "source": point.payload.get("source"),
            "score": point.score,
        }
        for point in result.points
    ]
