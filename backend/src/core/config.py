"""Central configuration: every setting the backend reads from the environment.

`settings` (created at the bottom) is validated once at import time; all other modules do
`from src.core.config import settings`. Values come from environment variables or a .env
file (see backend/.env.example for the full list).
"""
from pathlib import Path
from typing import Annotated, Literal, Optional

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/ and the repo root: a .env in either place works
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_ENV_FILES = (_BACKEND_DIR.parent / ".env", _BACKEND_DIR / ".env")


class Settings(BaseSettings):
    """All configuration, read once at import time and validated.

    Each field is filled from the environment variable with the same name (case-insensitive).
    Priority: real environment variables > backend/.env > repo-root .env > defaults below.
    A missing or invalid value raises a clear error at startup, not deep inside a request.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        # Ignore unrelated variables found in .env instead of failing
        extra="ignore",
    )

    # ---- Qdrant (vector database) ----
    # URL of Qdrant Cloud / local server, or ":memory:" for an in-process store (data lost on restart).
    # No default: forgetting it must fail loudly rather than connect to something unexpected.
    qdrant_host: str = Field(min_length=1)
    # API key, only needed for Qdrant Cloud
    qdrant_api_key: Optional[str] = None
    # Name of the collection (like a table) that holds all PDF chunks
    collection_name: str = Field(min_length=1)

    # ---- Embeddings ----
    # Model that converts text to vectors. The vector size is read from the model itself
    # (see embeddings.get_embedding_dim), so any SentenceTransformer model works,
    # but changing it requires a new collection.
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # ---- LLM (answer generation) ----
    # Which LLM backend generation.py builds: 'openai', 'gemini', 'ollama' (local server)
    # or 'huggingface' (local flan-t5)
    model_provider: Literal["openai", "gemini", "ollama", "huggingface"] = "openai"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    # Google AI Studio key (free tier available): https://aistudio.google.com/apikey
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.5-flash"
    # Ollama needs no API key, only a running server and a pulled model (`ollama pull llama3.1:8b`)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"

    # ---- HTTP API ----
    # Comma-separated list of browser origins allowed to call the API (CORS).
    # NoDecode: keep the raw string so the validator below splits it (default would expect JSON).
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    # Upload size limit in megabytes, enforced in main.py
    max_upload_mb: int = Field(default=5, gt=0)

    @field_validator("qdrant_api_key", "openai_api_key", "gemini_api_key", mode="before")
    @classmethod
    def _blank_key_is_none(cls, v):
        """Turn an empty API key string into None so "not set" has one representation."""
        # "QDRANT_API_KEY=" in .env arrives as "" - treat it as "not set"
        return v or None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        """Parse CORS_ORIGINS from a comma-separated string into a list of origins."""
        # "a, b,,c" -> ["a", "b", "c"]: trim spaces, drop empty entries
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _provider_needs_key(self):
        """Cross-field rule: fail at startup if a hosted provider is selected but its key is missing."""
        # A key is only required for the chosen provider
        if self.model_provider == "openai" and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when MODEL_PROVIDER=openai")
        if self.model_provider == "gemini" and not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini")
        return self


# Import this object everywhere: `from src.core.config import settings`
settings = Settings()
