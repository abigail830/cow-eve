from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from proposal_knowledge.application import catalog_service
from proposal_knowledge.infrastructure.db.session import session_scope
from proposal_knowledge.interfaces.mcp.request_context import require_auth

catalog_mcp = MCPServer(
    "proposal-catalog",
    instructions=(
        "Read-only product and package catalog. Always pick business_unit (from BU*) first. "
        "When jurisdictions matter, call list_jurisdictions then pass jurisdiction on searches."
    ),
)


@catalog_mcp.tool()
def list_business_units() -> list[dict]:
    """List business units (BU*) this API key may access, with product/package counts."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.list_business_units(session, auth)


@catalog_mcp.tool()
def list_jurisdictions(business_unit: str) -> list[str]:
    """Distinct Jurisdictions values for products under the given business_unit."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.list_jurisdictions(session, auth, business_unit)


@catalog_mcp.tool()
def search_products(
    business_unit: str,
    query: str,
    limit: int = 25,
    jurisdiction: str | None = None,
    department_team: str | None = None,
) -> list[dict]:
    """Search active products within a business_unit; optional jurisdiction and department_team filters."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.search_products(
            session,
            auth,
            business_unit=business_unit,
            query=query,
            limit=limit,
            jurisdiction=jurisdiction,
            department_team=department_team,
        )


@catalog_mcp.tool()
def get_product(
    business_unit: str,
    sku: str,
    jurisdiction: str | None = None,
) -> dict:
    """Get one product by SKU; optional jurisdiction validates applicability."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.get_product(
            session,
            auth,
            business_unit=business_unit,
            sku=sku,
            jurisdiction=jurisdiction,
        )


@catalog_mcp.tool()
def search_packages(
    business_unit: str,
    query: str,
    limit: int = 25,
    jurisdiction: str | None = None,
) -> list[dict]:
    """Search solution packages within a business_unit."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.search_packages(
            session,
            auth,
            business_unit=business_unit,
            query=query,
            limit=limit,
            jurisdiction=jurisdiction,
        )


@catalog_mcp.tool()
def get_package(business_unit: str, package_id: str) -> dict:
    """Get package metadata by id."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.get_package(
            session,
            auth,
            business_unit=business_unit,
            package_id=package_id,
        )


@catalog_mcp.tool()
def expand_package(
    business_unit: str,
    package_id: str,
    jurisdiction: str | None = None,
) -> dict:
    """Expand linked SKUs with pricing/jurisdiction coverage hints."""
    auth = require_auth()
    with session_scope() as session:
        return catalog_service.expand_package(
            session,
            auth,
            business_unit=business_unit,
            package_id=package_id,
            jurisdiction=jurisdiction,
        )
