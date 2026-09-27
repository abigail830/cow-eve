from __future__ import annotations

from parse_pipeline.schemas.job import SubmitJobRequest


def test_submit_job_preserves_audio_capture_parts() -> None:
    body = SubmitJobRequest.model_validate(
        {
            "pipeline_id": "audio_transcription_standard",
            "storage": {"read": {"url": "https://example.com/x.md"}},
            "source": {
                "source_type": "audio_capture",
                "source_id": "cap-1",
                "filename": "transcript.md",
                "capture": {
                    "capture_id": "cap-1",
                    "title": "Audio transcript",
                    "parts": [
                        {
                            "attachment_id": "att-audio-1",
                            "filename": "clip.m4a",
                            "sort_order": 0,
                        }
                    ],
                },
            },
        }
    )
    dumped = body.source.model_dump()
    assert dumped["capture"]["parts"][0]["attachment_id"] == "att-audio-1"
