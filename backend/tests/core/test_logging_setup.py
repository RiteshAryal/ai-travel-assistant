"""Tests for src/core/logging_setup.py."""
import logging

from src.core import logging_setup


def test_setup_logging_configures_info_level_with_readable_format(monkeypatch):
    calls = []
    # basicConfig is a no-op once handlers exist (pytest adds some), so capture the call instead
    monkeypatch.setattr(logging, "basicConfig", lambda **kwargs: calls.append(kwargs))

    logging_setup.setup_logging()

    assert len(calls) == 1
    assert calls[0]["level"] == logging.INFO
    fmt = calls[0]["format"]
    assert "%(asctime)s" in fmt and "%(levelname)s" in fmt and "%(name)s" in fmt and "%(message)s" in fmt
