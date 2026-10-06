from __future__ import annotations

from email.message import EmailMessage

from parse_pipeline.providers.local.email import parse_eml_bytes


def _build_sample_eml() -> bytes:
    msg = EmailMessage()
    msg["Subject"] = "Use of AI in Service Delivery"
    msg["From"] = "auditor@example.com"
    msg["To"] = "client@example.com"
    msg["Date"] = "Mon, 5 Oct 2026 12:00:00 +0000"
    msg.set_content("Plain body for auditors.")
    msg.add_alternative("<p>HTML <b>body</b></p>", subtype="html")
    msg.add_attachment(b"%PDF-1.4 sample", maintype="application", subtype="pdf", filename="report.pdf")
    return msg.as_bytes()


def test_parse_eml_extracts_headers_and_body() -> None:
    parsed = parse_eml_bytes(_build_sample_eml())
    assert "Use of AI" in parsed.markdown
    assert "auditor@example.com" in parsed.markdown
    assert "Plain body for auditors." in parsed.markdown
    assert parsed.meta["kind"] == "email"
    assert len(parsed.attachments) == 1
    assert parsed.attachments[0].filename == "report.pdf"
