"""Tests for src/core/vectorstore.py: client creation and collection setup/validation."""
import pytest
from qdrant_client.http.models import Distance, PointStruct, VectorParams

from src.core import vectorstore
from src.core.config import settings
from tests.conftest import FAKE_DIM, point_count


def recreate_collection(size):
    """Replace the test collection with an empty one of the given vector size."""
    client = vectorstore.get_qdrant_client()
    client.delete_collection(settings.collection_name)
    client.create_collection(
        settings.collection_name, vectors_config=VectorParams(size=size, distance=Distance.COSINE)
    )


# ---- get_qdrant_client ----


def test_client_is_shared():
    assert vectorstore.get_qdrant_client() is vectorstore.get_qdrant_client()


def test_remote_host_uses_url_and_api_key(monkeypatch):
    calls = []
    monkeypatch.setattr(vectorstore, "QdrantClient", lambda **kwargs: calls.append(kwargs) or object())
    monkeypatch.setattr(settings, "qdrant_host", "https://qdrant.example.com")
    monkeypatch.setattr(settings, "qdrant_api_key", "secret")

    vectorstore.get_qdrant_client.cache_clear()
    vectorstore.get_qdrant_client()

    assert calls == [{"url": "https://qdrant.example.com", "api_key": "secret"}]


def test_memory_host_uses_in_process_store(monkeypatch):
    calls = []
    monkeypatch.setattr(vectorstore, "QdrantClient", lambda **kwargs: calls.append(kwargs) or object())
    vectorstore.get_qdrant_client.cache_clear()
    vectorstore.get_qdrant_client()
    assert calls == [{"location": ":memory:"}]


# ---- init_qdrant ----


def test_init_creates_collection_with_model_size_and_cosine():
    client = vectorstore.get_qdrant_client()
    client.delete_collection(settings.collection_name)

    vectorstore.init_qdrant()

    params = client.get_collection(settings.collection_name).config.params.vectors
    assert params.size == FAKE_DIM
    assert params.distance == Distance.COSINE


def test_init_returns_the_shared_client():
    assert vectorstore.init_qdrant() is vectorstore.get_qdrant_client()


def test_init_is_idempotent_and_keeps_existing_data():
    client = vectorstore.get_qdrant_client()
    client.upsert(
        settings.collection_name,
        [PointStruct(id=1, vector=[0.1] * FAKE_DIM, payload={"text": "kept"})],
    )

    vectorstore.init_qdrant()
    vectorstore.init_qdrant()

    assert point_count() == 1


def test_init_rejects_collection_with_wrong_vector_size():
    recreate_collection(size=10)
    with pytest.raises(RuntimeError, match=f"vector size 10 .* produces {FAKE_DIM}"):
        vectorstore.init_qdrant()


def test_wrong_size_error_names_the_fix():
    recreate_collection(size=10)
    with pytest.raises(RuntimeError, match="COLLECTION_NAME"):
        vectorstore.init_qdrant()
