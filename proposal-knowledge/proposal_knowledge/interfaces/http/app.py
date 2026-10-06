from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.routing import Mount

from proposal_knowledge import __version__
from proposal_knowledge.config import get_settings
from proposal_knowledge.infrastructure.db.session import init_db
from proposal_knowledge.interfaces.http.admin_routes import router as admin_router
from proposal_knowledge.interfaces.http.mcp_auth import (
    McpAuthMiddleware,
    catalog_scope,
    cv_scope,
)
from proposal_knowledge.interfaces.mcp.catalog_server import catalog_mcp
from proposal_knowledge.interfaces.mcp.cv_server import cv_mcp


def create_app() -> FastAPI:
    init_db()
    settings = get_settings()

    catalog_asgi = catalog_mcp.streamable_http_app(stateless_http=True, host="0.0.0.0")
    catalog_asgi = McpAuthMiddleware(
        catalog_asgi,
        endpoint_scope=catalog_scope(),
        path_prefix=settings.catalog_mcp_public_path,
    )
    cv_asgi = cv_mcp.streamable_http_app(stateless_http=True, host="0.0.0.0")
    cv_asgi = McpAuthMiddleware(
        cv_asgi,
        endpoint_scope=cv_scope(),
        path_prefix=settings.cv_mcp_public_path,
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        async with catalog_mcp.session_manager.run():
            async with cv_mcp.session_manager.run():
                yield

    app = FastAPI(title="proposal-knowledge", version=__version__, lifespan=lifespan)
    app.include_router(admin_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "proposal-knowledge", "version": __version__}

    app.router.routes.append(Mount(settings.catalog_mcp_public_path, app=catalog_asgi))
    app.router.routes.append(Mount(settings.cv_mcp_public_path, app=cv_asgi))

    return app


app = create_app()
