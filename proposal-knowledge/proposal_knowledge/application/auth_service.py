from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from proposal_knowledge.config import get_settings
from proposal_knowledge.domain.auth import AuthorizedContext
from proposal_knowledge.infrastructure.db.models import ApiKeyRow

SCOPE_MCP_CATALOG = "mcp:catalog"
SCOPE_MCP_CV = "mcp:cv"


def _hash_key(raw: str) -> str:
    pepper = get_settings().api_key_hash_pepper.encode("utf-8")
    digest = hashlib.sha256(pepper + raw.encode("utf-8")).hexdigest()
    return digest


def generate_api_key(prefix: str = "pk_live_") -> str:
    return prefix + secrets.token_urlsafe(32)


def create_api_key_record(
    session: Session,
    *,
    label: str,
    scopes: list[str],
    allowed_business_units: list[str] | None,
    allow_all_business_units: bool,
) -> tuple[ApiKeyRow, str]:
    raw = generate_api_key()
    row = ApiKeyRow(
        label=label,
        key_prefix=raw[:12],
        key_hash=_hash_key(raw),
        scopes=scopes,
        allowed_business_units=allowed_business_units,
        allow_all_business_units=allow_all_business_units,
    )
    session.add(row)
    session.flush()
    return row, raw


def list_api_keys(session: Session) -> list[ApiKeyRow]:
    return list(session.scalars(select(ApiKeyRow).order_by(ApiKeyRow.created_at.desc())))


def revoke_api_key(session: Session, key_id: str) -> bool:
    row = session.get(ApiKeyRow, key_id)
    if row is None or row.revoked_at is not None:
        return False
    row.revoked_at = datetime.now(UTC)
    return True


def _parse_env_allowed_bus(raw: str) -> frozenset[str] | None:
    trimmed = raw.strip()
    if not trimmed or trimmed == "*":
        return None
    parts = [p.strip() for p in trimmed.split(",") if p.strip()]
    return frozenset(parts) if parts else None


def authorize_bearer(session: Session, token: str, endpoint_scope: str) -> AuthorizedContext:
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token.split(" ", 1)[1].strip()

    rows = session.scalars(
        select(ApiKeyRow).where(
            ApiKeyRow.revoked_at.is_(None),
            ApiKeyRow.key_prefix == token[:12],
        )
    ).all()
    for row in rows:
        if hmac.compare_digest(row.key_hash, _hash_key(token)):
            scopes = frozenset(row.scopes)
            if endpoint_scope not in scopes:
                raise PermissionError("API key lacks scope for this MCP endpoint.")
            allowed: frozenset[str] | None
            if row.allow_all_business_units:
                allowed = None
            else:
                allowed = frozenset(row.allowed_business_units or [])
            return AuthorizedContext(
                key_id=row.id,
                scopes=scopes,
                allowed_business_units=allowed,
            )

    settings = get_settings()
    env_key = settings.proposal_knowledge_mcp_api_key.strip()
    if env_key and hmac.compare_digest(env_key, token):
        scopes = frozenset([SCOPE_MCP_CATALOG, SCOPE_MCP_CV])
        if endpoint_scope not in scopes:
            raise PermissionError("Env bootstrap key lacks scope.")
        return AuthorizedContext(
            key_id="env-bootstrap",
            scopes=scopes,
            allowed_business_units=_parse_env_allowed_bus(
                settings.proposal_knowledge_allowed_bus
            ),
        )

    raise PermissionError("Invalid API key.")
