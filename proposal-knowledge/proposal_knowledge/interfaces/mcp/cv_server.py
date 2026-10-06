from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from proposal_knowledge.application import cv_service
from proposal_knowledge.infrastructure.db.session import session_scope
from proposal_knowledge.interfaces.mcp.request_context import require_auth

cv_mcp = MCPServer(
    "proposal-cv",
    instructions="Read-only team directory (CV) scoped by business_unit (BU*).",
)


@cv_mcp.tool()
def list_departments(business_unit: str) -> list[str]:
    """List departments with people under the business_unit."""
    auth = require_auth()
    with session_scope() as session:
        return cv_service.list_departments(session, auth, business_unit=business_unit)


@cv_mcp.tool()
def search_people(
    business_unit: str,
    query: str = "",
    department: str | None = None,
    limit: int = 25,
) -> list[dict]:
    """Search people in a business_unit."""
    auth = require_auth()
    with session_scope() as session:
        return cv_service.search_people(
            session,
            auth,
            business_unit=business_unit,
            query=query,
            department=department,
            limit=limit,
        )


@cv_mcp.tool()
def get_person(id: str) -> dict:
    """Get one person by id."""
    auth = require_auth()
    with session_scope() as session:
        return cv_service.get_person(session, auth, person_id=id)
