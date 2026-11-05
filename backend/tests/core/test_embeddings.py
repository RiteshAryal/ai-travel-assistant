"""Tests for src/core/embeddings.py (using FakeEmbeddingModel; the real model is never loaded)."""
from src.core import embeddings
from tests.conftest import FAKE_DIM


def test_get_embeddings_returns_one_vector_per_text():
    vectors = embeddings.get_embeddings(["paris louvre", "eiffel tower", "metro"])
    assert len(vectors) == 3
    assert all(len(v) == FAKE_DIM for v in vectors)


def test_get_embeddings_returns_plain_lists():
    # Qdrant needs plain Python lists, not numpy arrays
    vector = embeddings.get_embeddings(["paris"])[0]
    assert isinstance(vector, list)
    assert isinstance(vector[0], float)


def test_get_embeddings_is_deterministic():
    assert embeddings.get_embeddings(["paris"]) == embeddings.get_embeddings(["paris"])


def test_get_embeddings_empty_input():
    assert embeddings.get_embeddings([]) == []


def test_get_embedding_dim_comes_from_model():
    assert embeddings.get_embedding_dim() == FAKE_DIM


def test_get_model_is_cached(monkeypatch):
    # Undo the conftest fake to exercise the real get_model wiring, with a stub class instead
    import sys
    import types

    created = []

    class StubTransformer:
        def __init__(self, name):
            created.append(name)

    stub = types.ModuleType("sentence_transformers")
    stub.SentenceTransformer = StubTransformer
    # undo() removes conftest's fake get_model patch (the real function is back);
    # only then install the stub so it is not undone too
    monkeypatch.undo()
    monkeypatch.setitem(sys.modules, "sentence_transformers", stub)

    embeddings.get_model.cache_clear()
    try:
        assert embeddings.get_model() is embeddings.get_model()
        assert created == [embeddings.settings.embedding_model]
    finally:
        embeddings.get_model.cache_clear()
