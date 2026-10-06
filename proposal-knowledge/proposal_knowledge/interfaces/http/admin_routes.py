from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from proposal_knowledge.application.auth_service import (
    SCOPE_MCP_CATALOG,
    SCOPE_MCP_CV,
    create_api_key_record,
    list_api_keys,
    revoke_api_key,
)
from proposal_knowledge.config import get_settings
from proposal_knowledge.infrastructure.db.session import session_scope

router = APIRouter(prefix="/internal/v1", tags=["admin"])


class CreateApiKeyBody(BaseModel):
    label: str = Field(min_length=1, max_length=128)
    scopes: list[str] = Field(default_factory=lambda: [SCOPE_MCP_CATALOG, SCOPE_MCP_CV])
    allowed_business_units: list[str] | None = None
    allow_all_business_units: bool = False


class CreateApiKeyResponse(BaseModel):
    id: str
    label: str
    prefix: str
    api_key: str
    scopes: list[str]
    allowed_business_units: list[str] | None
    allow_all_business_units: bool


class ApiKeyListItem(BaseModel):
    id: str
    label: str
    prefix: str
    scopes: list[str]
    allowed_business_units: list[str] | None
    allow_all_business_units: bool
    created_at: str | None
    revoked_at: str | None


async def require_admin(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.proposal_knowledge_admin_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API is not configured.",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    token = authorization.split(" ", 1)[1].strip()
    import hmac

    if not hmac.compare_digest(token, settings.proposal_knowledge_admin_key.strip()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.post("/api-keys", response_model=CreateApiKeyResponse)
async def create_api_key(
    body: CreateApiKeyBody,
    _: None = Depends(require_admin),
) -> CreateApiKeyResponse:
    if not body.allow_all_business_units and not body.allowed_business_units:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide allowed_business_units or set allow_all_business_units.",
        )
    with session_scope() as session:
        row, raw = create_api_key_record(
            session,
            label=body.label,
            scopes=body.scopes,
            allowed_business_units=body.allowed_business_units,
            allow_all_business_units=body.allow_all_business_units,
        )
        return CreateApiKeyResponse(
            id=row.id,
            label=row.label,
            prefix=row.key_prefix,
            api_key=raw,
            scopes=row.scopes,
            allowed_business_units=row.allowed_business_units,
            allow_all_business_units=row.allow_all_business_units,
        )


@router.get("/api-keys", response_model=list[ApiKeyListItem])
async def get_api_keys(_: None = Depends(require_admin)) -> list[ApiKeyListItem]:
    with session_scope() as session:
        rows = list_api_keys(session)
        return [
            ApiKeyListItem(
                id=r.id,
                label=r.label,
                prefix=r.key_prefix,
                scopes=r.scopes,
                allowed_business_units=r.allowed_business_units,
                allow_all_business_units=r.allow_all_business_units,
                created_at=r.created_at.isoformat() if r.created_at else None,
                revoked_at=r.revoked_at.isoformat() if r.revoked_at else None,
            )
            for r in rows
        ]


@router.post("/api-keys/{key_id}/revoke")
async def revoke_key(key_id: str, _: None = Depends(require_admin)) -> dict[str, bool]:
    with session_scope() as session:
        ok = revoke_api_key(session, key_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return {"ok": True}
