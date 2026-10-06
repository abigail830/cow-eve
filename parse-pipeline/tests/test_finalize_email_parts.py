from __future__ import annotations

from parse_pipeline.normalize.artifacts import NormalizedArtifacts
from parse_pipeline.normalize.finalize import finalize_normalized_artifacts


def test_finalize_preserves_email_derived_parts() -> None:
    parts = [("nested.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"docx-bytes")]
    artifacts = NormalizedArtifacts(
        content_md="# Email\n\nBody",
        meta_json={
            "kind": "email",
            "attachment_count": 1,
            "parse_engine": "local_email",
        },
        email_derived_parts=parts,
    )
    finalized = finalize_normalized_artifacts(artifacts)
    assert finalized.email_derived_parts == parts
