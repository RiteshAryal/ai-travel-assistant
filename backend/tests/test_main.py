"""Tests for src/main.py: the HTTP routes, status codes and the SSE stream format."""
import json

import pymupdf
from fastapi.testclient import TestClient

from src import main
from tests.conftest import FAKE_ANSWER, point_count


def upload(client, content, filename="paris-travel-guide.pdf", mime="application/pdf"):
    """POST a file to /api/documents as multipart form data."""
    return client.post("/api/documents", files={"file": (filename, content, mime)})


def parse_sse(body: str):
    """Parse an SSE response body into a list of (event_name, json_data) tuples."""
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


# ---- health / CORS / lifespan ----


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "qdrant": True, "chunks": 0}


def test_health_reports_indexed_chunk_count(client, indexed_pdf):
    assert client.get("/api/health").json()["chunks"] == point_count() > 0


def test_health_degraded_when_qdrant_unreachable(client, monkeypatch):
    def down():
        raise ConnectionError("qdrant down")

    monkeypatch.setattr(main, "get_qdrant_client", down)
    assert client.get("/api/health").json() == {"status": "degraded", "qdrant": False, "chunks": 0}


def test_cors_allows_vite_dev_origin(client):
    res = client.options(
        "/api/ask",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_lifespan_initialises_store_and_preloads_models(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "init_qdrant", lambda: calls.append("qdrant"))
    monkeypatch.setattr(main, "get_model", lambda: calls.append("embedding"))
    monkeypatch.setattr(main, "get_qa_chain", lambda: calls.append("llm"))

    # Context manager = run startup/shutdown (lifespan) like a real server
    with TestClient(main.app):
        pass

    assert calls == ["qdrant", "embedding", "llm"]


# ---- POST /api/documents ----


def test_upload_without_file_is_400(client):
    res = client.post("/api/documents")
    assert res.status_code == 400
    assert res.json()["detail"] == "No file uploaded"


def test_upload_non_pdf_is_400(client):
    res = upload(client, b"hello", filename="notes.txt", mime="text/plain")
    assert res.status_code == 400
    assert res.json()["detail"] == "Please upload a PDF file"


def test_upload_corrupt_pdf_is_400(client):
    res = upload(client, b"not really a pdf", filename="broken.pdf")
    assert res.status_code == 400
    assert res.json()["detail"] == "File is not a valid PDF"


def test_upload_pdf_without_text_is_400(client):
    blank = pymupdf.open()
    blank.new_page()
    res = upload(client, blank.tobytes(), filename="blank.pdf")
    assert res.status_code == 400
    assert res.json()["detail"] == "No extractable text found in PDF"


def test_upload_too_large_is_413(client, monkeypatch, sample_pdf):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 10)
    res = upload(client, sample_pdf)
    assert res.status_code == 413


def test_upload_unexpected_error_is_500(client, monkeypatch, sample_pdf):
    def boom(content, filename):
        raise RuntimeError("qdrant exploded")

    monkeypatch.setattr(main, "ingest_pdf", boom)
    res = upload(client, sample_pdf)
    assert res.status_code == 500
    assert "qdrant exploded" not in res.json()["detail"]


def test_upload_pdf_and_reupload_does_not_duplicate(client, sample_pdf):
    res = upload(client, sample_pdf)
    assert res.status_code == 200
    body = res.json()
    assert body["filename"] == "paris-travel-guide.pdf"
    assert body["pages"] > 0 and body["chunks"] > 0
    assert point_count() == body["chunks"]

    assert upload(client, sample_pdf).status_code == 200
    assert point_count() == body["chunks"]


# ---- POST /api/ask ----


def test_ask_returns_answer_and_sources(client, fake_llm, indexed_pdf):
    res = client.post("/api/ask", json={"query": "Best places to visit in Paris"})
    assert res.status_code == 200
    body = res.json()
    assert body["response"] == FAKE_ANSWER
    assert len(body["sources"]) == 5
    assert {"text", "page", "source", "score"} <= body["sources"][0].keys()
    assert body["sources"][0]["source"] == "paris-travel-guide.pdf"


def test_ask_blank_query_is_422(client):
    assert client.post("/api/ask", json={"query": "   "}).status_code == 422


def test_ask_oversized_query_is_422(client):
    too_long = "a" * (main.MAX_QUERY_CHARS + 1)
    assert client.post("/api/ask", json={"query": too_long}).status_code == 422
    assert client.post("/api/ask/stream", json={"query": too_long}).status_code == 422


def test_ask_query_at_limit_is_accepted(client, fake_llm, indexed_pdf):
    at_limit = "a" * main.MAX_QUERY_CHARS
    assert client.post("/api/ask", json={"query": at_limit}).status_code == 200


def test_ask_missing_query_is_422(client):
    assert client.post("/api/ask", json={}).status_code == 422


def test_ask_without_indexed_guide_is_409(client, fake_llm):
    res = client.post("/api/ask", json={"query": "Paris"})
    assert res.status_code == 409
    assert "Upload a PDF" in res.json()["detail"]


def test_ask_llm_failure_is_500_with_detail(client, indexed_pdf, monkeypatch):
    def boom(query):
        raise RuntimeError("LLM down")

    monkeypatch.setattr(main, "generate_answer", boom)
    res = client.post("/api/ask", json={"query": "Paris"})
    assert res.status_code == 500
    # Internal error text must not leak to the client
    assert res.json()["detail"] == "Error generating answer, see server logs"


# ---- POST /api/ask/stream ----


def test_ask_stream_emits_sources_tokens_done(client, fake_llm, indexed_pdf):
    res = client.post("/api/ask/stream", json={"query": "Best places to visit in Paris"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert res.headers["cache-control"] == "no-cache"

    events = parse_sse(res.text)
    names = [name for name, _ in events]
    assert names[:2] == ["sources", "trace"]
    assert names[-1] == "done"
    assert set(names[2:-1]) == {"token"}
    assert set(events[1][1]) == {"embed", "search", "prompt", "llm"}
    # Only citation fields are sent, not the chunk text
    assert set(events[0][1][0]) == {"source", "page", "score"}
    assert "".join(data["t"] for name, data in events if name == "token") == FAKE_ANSWER


def test_ask_stream_blank_query_is_422(client):
    assert client.post("/api/ask/stream", json={"query": ""}).status_code == 422


def test_ask_stream_without_indexed_guide_is_409(client, fake_llm):
    res = client.post("/api/ask/stream", json={"query": "Paris"})
    assert res.status_code == 409
    assert "Upload a PDF" in res.json()["detail"]


def test_ask_proceeds_if_chunk_count_fails(client, fake_llm, monkeypatch):
    def boom():
        raise ConnectionError("count failed")

    monkeypatch.setattr(main, "indexed_chunks", boom)
    # Check is skipped; the (empty) store still answers through the normal path
    assert client.post("/api/ask", json={"query": "Paris"}).status_code == 200


def test_ask_stream_failure_emits_error_event(client, indexed_pdf, monkeypatch):
    async def boom(query):
        raise RuntimeError("LLM down")
        yield  # pragma: no cover

    monkeypatch.setattr(main, "stream_answer", boom)
    events = parse_sse(client.post("/api/ask/stream", json={"query": "Paris"}).text)
    assert events[-1][0] == "error"
    assert events[-1][1]["detail"] == "Error generating answer, see server logs"


# ---- sse() helper ----


def test_sse_format():
    assert main.sse("token", {"t": "hi"}) == 'event: token\ndata: {"t": "hi"}\n\n'
