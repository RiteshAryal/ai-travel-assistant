"""Shared test setup: fakes that keep tests fast, offline and free.

Nothing here loads a real embedding model, calls OpenAI or needs a Qdrant server:
- Qdrant runs in memory (QDRANT_HOST=:memory:)
- embeddings come from FakeEmbeddingModel (hashing, no download)
- the LLM is a GenericFakeChatModel that returns FAKE_ANSWER (fixture `fake_llm`)

Layout: one test file per source module (tests/test_main.py <-> src/main.py,
tests/core/test_config.py <-> src/core/config.py, ...).
"""
import hashlib
import os
from pathlib import Path

import numpy as np
import pytest

# Must be set before src.core.config is imported (settings are read at import time)
os.environ["QDRANT_HOST"] = ":memory:"
os.environ["COLLECTION_NAME"] = "test_collection"
os.environ["OPENAI_API_KEY"] = "test-key"

from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402

from src import generation, main  # noqa: E402
from src.core import embeddings, vectorstore  # noqa: E402

SAMPLE_PDF = Path(__file__).resolve().parents[2] / "data" / "paris-travel-guide.pdf"
FAKE_DIM = 384
FAKE_ANSWER = "Visit the Louvre and the Eiffel Tower"


class FakeEmbeddingModel:
    """Deterministic bag-of-words hashing into 384 dims; avoids downloading the real model.

    Texts that share words get similar vectors, so retrieval order is meaningful in tests.
    """

    def get_sentence_embedding_dimension(self):
        """Mimic SentenceTransformer's API; used by embeddings.get_embedding_dim()."""
        return FAKE_DIM

    def encode(self, texts):
        """Return a (len(texts), FAKE_DIM) numpy array of word-count vectors."""
        vectors = np.zeros((len(texts), FAKE_DIM))
        for row, text in enumerate(texts):
            for word in text.lower().split():
                idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % FAKE_DIM
                vectors[row, idx] += 1.0
        return vectors


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    """Runs for every test: fake embedder + a brand-new empty in-memory collection."""
    # Fake model first: init_qdrant asks it for the vector size
    monkeypatch.setattr(embeddings, "get_model", lambda: FakeEmbeddingModel())
    vectorstore.get_qdrant_client.cache_clear()
    vectorstore.init_qdrant()
    yield
    vectorstore.get_qdrant_client.cache_clear()


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the real LLM chain with one that always answers FAKE_ANSWER (once per call)."""

    def chain():
        llm = GenericFakeChatModel(messages=iter([AIMessage(content=FAKE_ANSWER)]))
        return generation.prompt_template | llm

    monkeypatch.setattr(generation, "get_qa_chain", chain)


@pytest.fixture
def client():
    """FastAPI test client for the whole app."""
    # No context manager: skip lifespan so the real models are never loaded
    return TestClient(main.app)


@pytest.fixture
def sample_pdf():
    """Bytes of data/paris-travel-guide.pdf, the sample travel guide."""
    return SAMPLE_PDF.read_bytes()


@pytest.fixture
def indexed_pdf(sample_pdf):
    """Sample PDF already ingested into the test collection (name: paris-travel-guide.pdf)."""
    from src.ingestion import ingest_pdf

    return ingest_pdf(sample_pdf, "paris-travel-guide.pdf")


def point_count():
    """Number of chunks currently stored in the test collection."""
    return vectorstore.get_qdrant_client().count(os.environ["COLLECTION_NAME"]).count
