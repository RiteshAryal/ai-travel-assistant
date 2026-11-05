"""Vector database access: the shared Qdrant client and collection setup.

Qdrant stores one vector (embedding) plus a payload (text, page, source) per PDF chunk.
ingestion.py writes to it, retrieval.py searches it, main.py calls init_qdrant() at startup.
"""
import logging
from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from src.core.config import settings
from src.core.embeddings import get_embedding_dim

logger = logging.getLogger(__name__)


# One shared client for the whole app (cached). Tests call .cache_clear() to get a fresh store.
@lru_cache(maxsize=1)
def get_qdrant_client():
    """Return the one shared QdrantClient (in-memory, local server or Qdrant Cloud per config)."""
    # ":memory:" runs an in-process store for local dev and tests (data lost on restart)
    if settings.qdrant_host == ":memory:":
        return QdrantClient(location=":memory:")
    # Otherwise connect over the network to Qdrant Cloud or a local Qdrant server
    return QdrantClient(
        url=settings.qdrant_host,
        api_key=settings.qdrant_api_key,
    )


def _collection_vector_size(client, name: str) -> int:
    """Return the vector length an existing collection was created with."""
    # Single unnamed vector config -> .config.params.vectors is a VectorParams
    return client.get_collection(name).config.params.vectors.size


def init_qdrant():
    """Make sure the collection exists with the right vector size. Safe to call on every startup.

    Raises RuntimeError if an existing collection was built for a different embedding model.
    """
    client = get_qdrant_client()
    name = settings.collection_name
    # Size comes from the embedding model, so the two can never silently disagree
    expected = get_embedding_dim()

    # Only create if missing, so restarting never wipes data that is already stored
    if not client.collection_exists(name):
        logger.info("Creating collection '%s' (vector size %d)", name, expected)
        client.create_collection(
            collection_name=name,
            # COSINE = similarity is judged by the angle between vectors (best for text embeddings)
            vectors_config=VectorParams(size=expected, distance=Distance.COSINE),
        )
        return client

    # Collection exists: fail at startup if it was made for another model, otherwise every
    # upload and search would error later with a confusing dimension mismatch
    actual = _collection_vector_size(client, name)
    if actual != expected:
        raise RuntimeError(
            f"Collection '{name}' has vector size {actual} but model "
            f"'{settings.embedding_model}' produces {expected}. "
            "Use a new COLLECTION_NAME or delete the old collection."
        )

    return client
