from __future__ import annotations

from contextvars import ContextVar

from proposal_knowledge.domain.auth import AuthorizedContext

authorized_context: ContextVar[AuthorizedContext | None] = ContextVar(
    "authorized_context", default=None
)


def require_auth() -> AuthorizedContext:
    ctx = authorized_context.get()
    if ctx is None:
        raise PermissionError("Missing authorization context.")
    return ctx
