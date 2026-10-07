from __future__ import annotations

import re

_INCORP_BU_RE = re.compile(r"^INCORP-(.+)$", re.IGNORECASE)
_INCORP_TOKEN_RE = re.compile(r"INCORP-([A-Za-z0-9]+)", re.IGNORECASE)
_INCORP_WORD_RE = re.compile(r"\bincorp\b", re.IGNORECASE)


def sanitize_business_unit(raw: str) -> str:
    """INCORP-XX → Acorp-XX (preserve region suffix)."""
    text = raw.strip()
    m = _INCORP_BU_RE.match(text)
    if m:
        return f"Acorp-{m.group(1)}"
    return sanitize_free_text(text) or text


def sanitize_free_text(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    def _bu_sub(match: re.Match[str]) -> str:
        return f"Acorp-{match.group(1)}"

    text = _INCORP_TOKEN_RE.sub(_bu_sub, text)
    text = _INCORP_WORD_RE.sub("Acorp", text)
    return text or None


def sanitize_jurisdictions(values: list[str]) -> list[str]:
    out: list[str] = []
    for v in values:
        s = sanitize_free_text(v)
        if s:
            out.append(s)
    return out


def sanitize_linked_skus(values: list[str]) -> list[str]:
    return [sanitize_free_text(v) or v for v in values]
