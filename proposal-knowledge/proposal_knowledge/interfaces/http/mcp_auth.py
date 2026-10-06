from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from proposal_knowledge.application.auth_service import (
    SCOPE_MCP_CATALOG,
    SCOPE_MCP_CV,
    authorize_bearer,
)
from proposal_knowledge.infrastructure.db.session import session_scope
from proposal_knowledge.interfaces.mcp.request_context import authorized_context


class McpAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, endpoint_scope: str, path_prefix: str):
        super().__init__(app)
        self.endpoint_scope = endpoint_scope
        self.path_prefix = path_prefix.rstrip("/")

    async def dispatch(self, request: Request, call_next) -> Response:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        try:
            with session_scope() as session:
                ctx = authorize_bearer(session, auth_header, self.endpoint_scope)
            token = authorized_context.set(ctx)
            try:
                return await call_next(request)
            finally:
                authorized_context.reset(token)
        except PermissionError as err:
            return JSONResponse({"error": str(err)}, status_code=403)


def catalog_scope() -> str:
    return SCOPE_MCP_CATALOG


def cv_scope() -> str:
    return SCOPE_MCP_CV
