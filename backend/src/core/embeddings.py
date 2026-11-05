"""Text embeddings: convert text into vectors so similar meanings are close together.

Wraps one SentenceTransformer model (EMBEDDING_MODEL). The same model must embed both the
PDF chunks (ingestion.py) and the user question (retrieval.py), or search results are meaningless.
"""
from functools import lru_cache
from src.core.config import settings


# lru_cache(maxsize=1) = load the model once, then reuse the same object.
# Loading takes seconds and hundreds of MB, so it must never happen per request.
@lru_cache(maxsize=1)
def get_model():
    """Return the shared SentenceTransformer, loading it on first use (downloads on first run)."""
    # Imported inside the function so merely importing this module does not pull in torch
    # (keeps startup and tests fast; the model is only loaded when first needed)
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embedding_model)


def get_embedding_dim() -> int:
    """Length of the vectors the current model produces (384 for all-MiniLM-L6-v2).

    The Qdrant collection must be created with exactly this size, so it is asked
    from the model instead of being hardcoded next to the model name.
    """
    return get_model().get_sentence_embedding_dimension()


def get_embeddings(texts):
    """Convert a list of strings into a list of vectors (one list of floats per string).

    Used for both sides of RAG: chunks at upload time and the question at ask time,
    so both live in the same vector space and can be compared.
    """
    # encode() returns a numpy array; .tolist() makes plain Python lists that Qdrant accepts.
    # Tests replace get_model() with a fake, so this stays the single swap point.
    return get_model().encode(texts).tolist()
