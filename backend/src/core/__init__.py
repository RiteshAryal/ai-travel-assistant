"""Shared building blocks used by the rest of the backend.

- config:       reads environment variables (single source of settings)
- embeddings:   turns text into vectors (SentenceTransformer)
- vectorstore:  Qdrant client + collection setup

Kept empty on purpose: importing the package must not import config, because
the tests set environment variables before the first import of src.core.config.
"""
