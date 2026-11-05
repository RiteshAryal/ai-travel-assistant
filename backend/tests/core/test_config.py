"""Tests for src/core/config.py: defaults, required values and validation of Settings."""
import pytest
from pydantic import ValidationError

from src.core.config import Settings

# Smallest valid config that needs no OpenAI key
BASE = dict(qdrant_host=":memory:", collection_name="c", model_provider="huggingface")


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Remove variables conftest sets for the app so each test controls its own inputs."""
    for name in ("QDRANT_HOST", "COLLECTION_NAME", "OPENAI_API_KEY", "GEMINI_API_KEY", "MODEL_PROVIDER"):
        monkeypatch.delenv(name, raising=False)


def make(**values):
    """Build Settings from explicit values only (_env_file=None ignores any real .env)."""
    return Settings(_env_file=None, **values)


def test_required_values_missing():
    with pytest.raises(ValidationError):
        make(openai_api_key="k")


@pytest.mark.parametrize("missing", ["qdrant_host", "collection_name"])
def test_each_required_value_is_enforced(missing):
    values = {**BASE}
    del values[missing]
    with pytest.raises(ValidationError, match=missing):
        make(**values)


def test_empty_required_value_rejected():
    with pytest.raises(ValidationError):
        make(**{**BASE, "collection_name": ""})


def test_openai_requires_key():
    with pytest.raises(ValidationError, match="OPENAI_API_KEY"):
        make(**{**BASE, "model_provider": "openai"})


def test_openai_with_key_is_valid():
    assert make(**{**BASE, "model_provider": "openai", "openai_api_key": "k"}).openai_api_key == "k"


def test_huggingface_needs_no_key():
    assert make(**BASE).openai_api_key is None


def test_unknown_provider_rejected():
    with pytest.raises(ValidationError):
        make(**{**BASE, "model_provider": "bogus"})


def test_blank_api_keys_become_none():
    s = make(**BASE, qdrant_api_key="", openai_api_key="")
    assert s.qdrant_api_key is None
    assert s.openai_api_key is None


def test_defaults():
    s = make(**BASE)
    assert s.embedding_model == "sentence-transformers/all-MiniLM-L6-v2"
    assert s.openai_model == "gpt-3.5-turbo"
    assert s.max_upload_mb == 5
    assert s.cors_origins == ["http://localhost:5173"]


def test_cors_origins_split_and_trimmed():
    s = make(**BASE, cors_origins="http://a.com, http://b.com,,")
    assert s.cors_origins == ["http://a.com", "http://b.com"]


@pytest.mark.parametrize("bad", [0, -1])
def test_max_upload_must_be_positive(bad):
    with pytest.raises(ValidationError):
        make(**BASE, max_upload_mb=bad)


def test_values_read_from_environment(monkeypatch):
    monkeypatch.setenv("QDRANT_HOST", "http://qdrant:6333")
    monkeypatch.setenv("COLLECTION_NAME", "from_env")
    monkeypatch.setenv("MODEL_PROVIDER", "huggingface")
    monkeypatch.setenv("MAX_UPLOAD_MB", "20")
    monkeypatch.setenv("CORS_ORIGINS", "http://x.com,http://y.com")
    s = make()
    assert (s.qdrant_host, s.collection_name, s.max_upload_mb) == ("http://qdrant:6333", "from_env", 20)
    assert s.cors_origins == ["http://x.com", "http://y.com"]


def test_gemini_requires_key():
    with pytest.raises(ValidationError, match="GEMINI_API_KEY"):
        make(**{**BASE, "model_provider": "gemini"})
    assert make(**{**BASE, "model_provider": "gemini", "gemini_api_key": "k"}).gemini_api_key == "k"


def test_ollama_needs_no_key():
    assert make(**{**BASE, "model_provider": "ollama"}).ollama_base_url == "http://localhost:11434"
