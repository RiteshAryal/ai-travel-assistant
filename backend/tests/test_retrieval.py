"""Tests for src/retrieval.py: embedding the question and finding the nearest chunks."""
from src.ingestion import ingest_pdf
from src.retrieval import retrieve_docs


def test_empty_collection_returns_no_docs():
    assert retrieve_docs("anything") == []


def test_returns_top_5_by_default(indexed_pdf):
    assert len(retrieve_docs("Best places to visit in Paris")) == 5


def test_top_k_limits_results(indexed_pdf):
    assert len(retrieve_docs("Paris", top_k=2)) == 2


def test_result_shape(indexed_pdf):
    doc = retrieve_docs("Paris")[0]
    assert set(doc) == {"text", "page", "source", "score"}
    assert doc["source"] == "paris-travel-guide.pdf"
    assert isinstance(doc["page"], int)
    assert doc["text"]


def test_results_sorted_by_score_descending(indexed_pdf):
    scores = [d["score"] for d in retrieve_docs("Best places to visit in Paris", top_k=5)]
    assert scores == sorted(scores, reverse=True)


def test_most_similar_chunk_comes_first(sample_pdf, indexed_pdf):
    # Querying with a chunk's own text must return that chunk as the best match
    target = retrieve_docs("Paris", top_k=3)[1]["text"]
    best = retrieve_docs(target, top_k=1)[0]
    assert best["text"] == target


def test_results_cover_multiple_sources(sample_pdf):
    ingest_pdf(sample_pdf, "a.pdf")
    ingest_pdf(sample_pdf, "b.pdf")
    sources = {d["source"] for d in retrieve_docs("Paris", top_k=10)}
    assert sources == {"a.pdf", "b.pdf"}


def test_trace_is_filled_only_when_requested(indexed_pdf):
    trace = {}
    docs = retrieve_docs("Paris", trace=trace)
    assert trace["embed"]["query"] == "Paris" and trace["embed"]["dim"] == 384
    assert trace["search"]["top_k"] == 5
    assert [h["page"] for h in trace["search"]["hits"]] == [d["page"] for d in docs]
    assert all(len(h["text"]) <= 200 for h in trace["search"]["hits"])
    assert trace["embed"]["ms"] >= 0 and trace["search"]["ms"] >= 0

