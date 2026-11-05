"""Generation step of RAG: ask the LLM to answer using the retrieved chunks.

    question -> retrieval.retrieve_docs -> chunk texts joined as {context}
             -> prompt_template | LLM -> answer text (+ the chunks as sources)

Two entry points: generate_answer (one full answer) and stream_answer (token by token).
"""
import asyncio
from functools import lru_cache
from typing import AsyncIterator, Tuple

from langchain_core.prompts import PromptTemplate
from src.retrieval import retrieve_docs
from src.core.config import settings


# The instructions sent to the LLM. {context} = retrieved chunks, {question} = user query.
# "say you don't know" discourages the model from inventing facts that are not in the PDFs.
prompt_template = PromptTemplate(
    input_variables=["context", "question"],
    template="""You are a helpful travel assistant.
Use the following travel guide context to answer the question.
If the answer is not found, say you don't know — don’t make it up.

Context:
{context}

Question:
{question}

Answer:"""
)


def _build_llm():
    """Create the LLM object for the provider chosen by MODEL_PROVIDER.

    'huggingface' = local google/flan-t5-base (free, slow, downloads the model),
    'openai' = ChatOpenAI API (needs OPENAI_API_KEY),
    'gemini' = Google Gemini API (needs GEMINI_API_KEY, free tier available),
    'ollama' = local Ollama server (no key, needs OLLAMA_BASE_URL + a pulled OLLAMA_MODEL).
    """
    # Provider libraries are imported lazily so the OpenAI path never loads torch/transformers
    if settings.model_provider == "huggingface":
        from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
        from langchain_huggingface import HuggingFacePipeline

        model_id = "google/flan-t5-base"
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
        pipe = pipeline(
            "text2text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=256,
            do_sample=True,
            temperature=0.7,
            top_k=50,
            top_p=0.95,
        )
        return HuggingFacePipeline(pipeline=pipe)
    if settings.model_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(api_key=settings.openai_api_key, model=settings.openai_model, temperature=0.7)
    if settings.model_provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            google_api_key=settings.gemini_api_key, model=settings.gemini_model, temperature=0.7
        )
    if settings.model_provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(base_url=settings.ollama_base_url, model=settings.ollama_model, temperature=0.7)
    raise ValueError(f"Unknown MODEL_PROVIDER: {settings.model_provider}")


@lru_cache(maxsize=1)
def get_qa_chain():
    """Return the cached chain `prompt | LLM` (built once, since loading an LLM is expensive).

    The `|` operator (LangChain) pipes the filled prompt into the LLM.
    """
    return prompt_template | _build_llm()


def _to_text(chunk) -> str:
    """Normalise LLM output to a plain string (providers return different types)."""
    # Chat models (OpenAI/Gemini/Ollama) return message objects with .content; HuggingFacePipeline returns plain strings
    if isinstance(chunk, str):
        return chunk
    content = chunk.content
    # Gemini may return a list of content blocks instead of a string
    if isinstance(content, list):
        return "".join(b if isinstance(b, str) else b.get("text", "") for b in content)
    return content


def _build_context(docs) -> str:
    """Join the retrieved chunk texts into the single {context} string for the prompt."""
    return "\n".join(doc["text"] for doc in docs)


def generate_answer(query: str) -> dict:
    """Blocking: retrieve chunks, call the LLM once, return {"answer": str, "sources": [chunks]}."""
    docs = retrieve_docs(query)
    result = get_qa_chain().invoke({"context": _build_context(docs), "question": query})
    return {"answer": _to_text(result), "sources": docs}


async def stream_answer(query: str) -> AsyncIterator[Tuple[str, object]]:
    """Yield ("sources", docs) once, then ("token", text) for each generated chunk."""
    # Retrieval is blocking (embedding + network): run in a thread to keep the event loop free
    docs = await asyncio.to_thread(retrieve_docs, query)
    # Sources first, so the UI can show citations while the answer is still being written
    yield "sources", docs

    # astream yields the answer piece by piece as the LLM produces it
    async for chunk in get_qa_chain().astream({"context": _build_context(docs), "question": query}):
        text = _to_text(chunk)
        # Skip empty pieces (some providers send empty first/last chunks)
        if text:
            yield "token", text
