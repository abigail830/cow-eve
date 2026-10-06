from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./proposal_knowledge.db"
    proposal_knowledge_admin_key: str = ""
    proposal_knowledge_mcp_api_key: str = ""
    """Env-only MCP key when no DB keys exist (bootstrap)."""
    proposal_knowledge_allowed_bus: str = "*"
    """Comma-separated BU allowlist for env bootstrap key, or *."""
    api_key_hash_pepper: str = "dev-pepper-change-me"
    catalog_mcp_public_path: str = "/api/mcp/catalog"
    cv_mcp_public_path: str = "/api/mcp/cv"
    avatar_public_base_url: str = ""
    """Override CDN/Blob base; relative avatar_blob_path values are joined to this URL."""
    blob_store_id: str = ""
    """Vercel Blob store id (store_… or bare id). Used when AVATAR_PUBLIC_BASE_URL is unset."""
    blob_access: str = "private"
    """Vercel Blob access mode: public or private (hostname segment)."""


def resolve_avatar_public_base_url(settings: Settings | None = None) -> str:
    s = settings or get_settings()
    explicit = s.avatar_public_base_url.strip().rstrip("/")
    if explicit:
        return explicit
    store_raw = s.blob_store_id.strip()
    store_id = store_raw.removeprefix("store_") if store_raw else ""
    if not store_id:
        return ""
    access = "public" if s.blob_access.strip().lower() == "public" else "private"
    return f"https://{store_id}.{access}.blob.vercel-storage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
