"""Tests for src/generation.py: prompt building, LLM selection and (streamed) answers."""
import asyncio

import pytest

from src import generation
from src.core.config import settings
from tests.conftest import FAKE_ANSWER


class Msg:
    """Stands in for a ChatOpenAI message chunk (has .content)."""

    content = "hi"


# ---- helpers ----


def test_to_text_handles_both_providers():
    assert generation._to_text("hi") == "hi"
    assert generation._to_text(Msg()) == "hi"


def test_build_context_joins_chunk_texts_with_newlines():
    docs = [{"text": "one"}, {"text": "two"}, {"text": "three"}]
    assert generation._build_context(docs) == "one\ntwo\nthree"


def test_build_context_empty():
    assert generation._build_context([]) == ""


def test_prompt_contains_context_question_and_dont_know_rule():
    prompt = generation.prompt_template.format(context="CTX", question="QUE")
    assert "CTX" in prompt and "QUE" in prompt
    assert "don't know" in prompt


# ---- _build_llm / get_qa_chain ----


def test_build_llm_openai_uses_configured_model(monkeypatch):
    monkeypatch.setattr(settings, "model_provider", "openai")
    monkeypatch.setattr(settings, "openai_model", "gpt-test")
    llm = generation._build_llm()
    assert type(llm).__name__ == "ChatOpenAI"
    assert llm.model_name == "gpt-test"


def test_build_llm_gemini_uses_configured_model(monkeypatch):
    monkeypatch.setattr(settings, "model_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "k")
    monkeypatch.setattr(settings, "gemini_model", "gemini-test")
    llm = generation._build_llm()
    assert type(llm).__name__ == "ChatGoogleGenerativeAI"
    assert llm.model == "gemini-test"


def test_build_llm_ollama_uses_configured_model(monkeypatch):
    monkeypatch.setattr(settings, "model_provider", "ollama")
    monkeypatch.setattr(settings, "ollama_model", "llama-test")
    llm = generation._build_llm()
    assert type(llm).__name__ == "ChatOllama"
    assert llm.model == "llama-test"


def test_build_llm_unknown_provider_raises(monkeypatch):
    monkeypatch.setattr(settings, "model_provider", "bogus")
    with pytest.raises(ValueError, match="Unknown MODEL_PROVIDER: bogus"):
        generation._build_llm()


def test_get_qa_chain_is_cached(monkeypatch):
    generation.get_qa_chain.cache_clear()
    built = []
    monkeypatch.setattr(generation, "_build_llm", lambda: built.append(1) or (lambda x: x))
    try:
        assert generation.get_qa_chain() is generation.get_qa_chain()
        assert len(built) == 1
    finally:
        generation.get_qa_chain.cache_clear()


# ---- generate_answer ----


def test_generate_answer_returns_answer_and_sources(fake_llm, indexed_pdf):
    result = generation.generate_answer("Best places to visit in Paris")
    assert result["answer"] == FAKE_ANSWER
    assert len(result["sources"]) == 5


def test_generate_answer_with_empty_store_still_answers(fake_llm):
    result = generation.generate_answer("anything")
    assert result["answer"] == FAKE_ANSWER
    assert result["sources"] == []


# ---- stream_answer ----


def collect(query):
    """Run the async generator to completion and return all (kind, data) items."""

    async def run():
        return [item async for item in generation.stream_answer(query)]

    return asyncio.run(run())


def test_stream_answer_yields_sources_first_then_tokens(fake_llm, indexed_pdf):
    items = collect("Best places to visit in Paris")
    kinds = [kind for kind, _ in items]
    assert kinds[0] == "sources"
    assert len(items[0][1]) == 5
    assert set(kinds[1:]) == {"token"}
    assert "".join(data for kind, data in items if kind == "token") == FAKE_ANSWER


def test_stream_answer_skips_empty_chunks(monkeypatch, indexed_pdf):
    class Chain:
        async def astream(self, inputs):
            for piece in ["a", "", "b"]:
                yield piece

    monkeypatch.setattr(generation, "get_qa_chain", lambda: Chain())
    tokens = [data for kind, data in collect("Paris") if kind == "token"]
    assert tokens == ["a", "b"]
