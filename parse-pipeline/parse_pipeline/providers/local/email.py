from __future__ import annotations

import email.policy
from dataclasses import dataclass
from email import message_from_bytes
from email.header import decode_header, make_header
from html.parser import HTMLParser
from typing import Any


@dataclass(frozen=True)
class EmailAttachmentPart:
    filename: str
    mime_type: str
    data: bytes
    content_hash_hint: str | None = None


@dataclass(frozen=True)
class SkippedEmailPart:
    filename: str
    reason: str


@dataclass(frozen=True)
class ParsedEmail:
    markdown: str
    meta: dict[str, Any]
    attachments: list[EmailAttachmentPart]
    skipped_parts: list[SkippedEmailPart]
    warnings: list[str]


class _SimpleHtmlText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self._chunks.append(data)

    def text(self) -> str:
        return "\n".join(self._chunks).strip()


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value.strip()


def _html_to_text(html: str) -> str:
    parser = _SimpleHtmlText()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        return html
    return parser.text() or html.strip()


def _part_body_text(part: email.message.Message) -> str:
    content_type = (part.get_content_type() or "").lower()
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        text = payload.decode(charset, errors="replace")
    except LookupError:
        text = payload.decode("utf-8", errors="replace")
    if content_type == "text/html":
        return _html_to_text(text)
    return text.strip()


def _pick_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        plain: str | None = None
        html: str | None = None
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            disposition = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue
            ctype = (part.get_content_type() or "").lower()
            if ctype == "text/plain" and plain is None:
                plain = _part_body_text(part)
            elif ctype == "text/html" and html is None:
                html = _part_body_text(part)
        if plain:
            return plain
        if html:
            return html
        return ""
    return _part_body_text(msg)


def _filename_from_part(part: email.message.Message) -> str:
    name = part.get_filename()
    if name:
        return _decode_header_value(name)
    return "attachment.bin"


def _collect_parts(msg: email.message.Message) -> tuple[list[EmailAttachmentPart], list[SkippedEmailPart], list[str]]:
    attachments: list[EmailAttachmentPart] = []
    skipped: list[SkippedEmailPart] = []
    warnings: list[str] = []

    if not msg.is_multipart():
        return attachments, skipped, warnings

    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        disposition = (part.get("Content-Disposition") or "").lower()
        ctype = (part.get_content_type() or "").lower()
        is_attachment = "attachment" in disposition
        if not is_attachment:
            if ctype in {"message/rfc822", "application/vnd.ms-outlook"}:
                skipped.append(
                    SkippedEmailPart(
                        filename=_filename_from_part(part),
                        reason="nested_message_not_supported",
                    )
                )
            continue
        payload = part.get_payload(decode=True)
        if payload is None or len(payload) == 0:
            warnings.append(f"empty_attachment:{_filename_from_part(part)}")
            continue
        filename = _filename_from_part(part)
        if filename.lower().endswith(".msg"):
            skipped.append(SkippedEmailPart(filename=filename, reason="unsupported_type"))
            continue
        mime = ctype or "application/octet-stream"
        attachments.append(
            EmailAttachmentPart(filename=filename, mime_type=mime, data=payload),
        )
    return attachments, skipped, warnings


def _address_list(msg: email.message.Message, key: str) -> list[str]:
    raw = msg.get_all(key, [])
    out: list[str] = []
    for item in raw:
        decoded = _decode_header_value(str(item))
        if decoded:
            out.append(decoded)
    return out


def parse_eml_bytes(data: bytes) -> ParsedEmail:
    msg = message_from_bytes(data, policy=email.policy.default)
    subject = _decode_header_value(msg.get("Subject"))
    from_addr = _decode_header_value(msg.get("From"))
    to_addrs = _address_list(msg, "To")
    cc_addrs = _address_list(msg, "Cc")
    date = _decode_header_value(msg.get("Date"))
    body = _pick_body(msg)
    attachments, skipped, warnings = _collect_parts(msg)

    lines = [
        "# Email",
        "",
        f"- **Subject:** {subject or '(none)'}",
        f"- **From:** {from_addr or '(unknown)'}",
    ]
    if to_addrs:
        lines.append(f"- **To:** {', '.join(to_addrs)}")
    if cc_addrs:
        lines.append(f"- **Cc:** {', '.join(cc_addrs)}")
    if date:
        lines.append(f"- **Date:** {date}")
    lines.extend(["", "---", "", body or "_(empty body)_"])

    meta: dict[str, Any] = {
        "kind": "email",
        "subject": subject,
        "from": from_addr,
        "to": to_addrs,
        "cc": cc_addrs,
        "date": date,
        "attachment_count": len(attachments),
        "skipped_parts": [{"filename": s.filename, "reason": s.reason} for s in skipped],
        "derived_attachment_ids": [],
        "derived_parts": [],
    }

    return ParsedEmail(
        markdown="\n".join(lines).strip() + "\n",
        meta=meta,
        attachments=attachments,
        skipped_parts=skipped,
        warnings=warnings,
    )
