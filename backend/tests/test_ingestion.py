"""Tests for src/ingestion.py: PDF -> chunks -> vectors stored in Qdrant."""
import pymupdf
import pytest

from src.core import vectorstore
from src.core.config import settings
from src.ingestion import chunk_id, ingest_pdf
from tests.conftest import point_count


def stored_points():
    """All points currently in the test collection (with payloads)."""
    points, _ = vectorstore.get_qdrant_client().scroll(
        settings.collection_name, limit=1000, with_payload=True
    )
    return points


def make_pdf(*page_texts: str) -> bytes:
    """Build a small PDF in memory with one page per given text."""
    doc = pymupdf.open()
    for text in page_texts:
        doc.new_page().insert_text((72, 72), text)
    return doc.tobytes()


# ---- chunk_id ----


def test_chunk_id_is_deterministic():
    assert chunk_id("a.pdf", 0, 1) == chunk_id("a.pdf", 0, 1)


def test_chunk_id_differs_by_file_page_and_index():
    ids = {chunk_id("a.pdf", 0, 0), chunk_id("b.pdf", 0, 0), chunk_id("a.pdf", 1, 0), chunk_id("a.pdf", 0, 1)}
    assert len(ids) == 4


# ---- ingest_pdf ----


def test_ingest_returns_page_and_chunk_counts(sample_pdf):
    result = ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    assert result["pages"] > 0
    assert result["chunks"] >= result["pages"]
    assert point_count() == result["chunks"]


def test_ingest_reports_stage_timings(sample_pdf):
    timings = ingest_pdf(sample_pdf, "paris-travel-guide.pdf")["timings"]
    assert set(timings) == {"extract_ms", "chunk_ms", "embed_ms", "store_ms"}
    assert all(isinstance(v, int) and v >= 0 for v in timings.values())


def test_ingest_reports_stage_trace(sample_pdf):
    result = ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    trace = result["trace"]
    assert set(trace) == {"extract", "chunk", "embed", "store"}
    assert trace["extract"]["bytes"] == len(sample_pdf)
    assert trace["extract"]["pages"] == result["pages"]
    assert trace["chunk"]["count"] == result["chunks"]
    assert len(trace["chunk"]["first"]) <= 200
    assert trace["embed"]["count"] == result["chunks"] and trace["embed"]["dim"] == 384
    assert trace["store"]["points"] == result["chunks"]


def test_ingest_stores_text_page_and_source(sample_pdf):
    ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    payload = stored_points()[0].payload
    assert payload["text"]
    assert payload["source"] == "paris-travel-guide.pdf"
    assert isinstance(payload["page"], int)


def test_ingest_pages_are_zero_based():
    ingest_pdf(make_pdf("first page text", "second page text"), "two.pdf")
    pages = {p.payload["page"] for p in stored_points()}
    assert pages == {0, 1}


def test_ingest_chunks_stay_near_size_limit(sample_pdf):
    ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    assert all(len(p.payload["text"]) <= 500 for p in stored_points())


def test_reingest_same_file_overwrites(sample_pdf):
    first = ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    ingest_pdf(sample_pdf, "paris-travel-guide.pdf")
    assert point_count() == first["chunks"]


def test_different_filenames_are_stored_separately(sample_pdf):
    first = ingest_pdf(sample_pdf, "a.pdf")
    ingest_pdf(sample_pdf, "b.pdf")
    assert point_count() == first["chunks"] * 2


def test_ingest_rejects_invalid_pdf():
    with pytest.raises(ValueError, match="not a valid PDF"):
        ingest_pdf(b"definitely not a pdf", "bad.pdf")
    assert point_count() == 0


def test_ingest_rejects_pdf_without_text():
    blank = pymupdf.open()
    blank.new_page()
    with pytest.raises(ValueError, match="No extractable text"):
        ingest_pdf(blank.tobytes(), "blank.pdf")
    assert point_count() == 0
