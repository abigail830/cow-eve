from __future__ import annotations

import pytest

from parse_pipeline.storage.io import parse_email_derived_response


def test_accepts_new_materialization() -> None:
    assert parse_email_derived_response({"created": 2, "skipped": 0, "dedupe_skipped": 0}, 2) == 2


def test_accepts_idempotent_dedupe_only() -> None:
    assert (
        parse_email_derived_response({"created": 0, "skipped": 0, "dedupe_skipped": 2}, 2)
        == 2
    )


def test_accepts_legacy_dedupe_counted_as_skipped() -> None:
    assert parse_email_derived_response({"created": 0, "skipped": 2}, 2) == 2


def test_rejects_unaccounted_parts() -> None:
    with pytest.raises(RuntimeError, match="part count mismatch"):
        parse_email_derived_response({"created": 1, "skipped": 0, "dedupe_skipped": 0}, 2)
