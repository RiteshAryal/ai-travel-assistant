"""Logging setup: one place that decides how backend log lines look.

Modules log with `logger = logging.getLogger(__name__)`; this file only configures the output.
"""
import logging


def setup_logging() -> None:
    """Send all app logs (logger = logging.getLogger(__name__)) to the console.

    Called once from main.py. Format: time, level, module, message.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
