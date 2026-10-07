from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from proposal_knowledge.application import catalog_service
from proposal_knowledge.application.catalog_recall import (
    recall_catalog as run_recall_catalog,
)
from proposal_knowledge.infrastructure.db.session import session_scope
from proposal_knowledge.interfaces.mcp.request_context import require_auth

catalog_mcp = MCPServer(
    "proposal-catalog",
    instructions=(
        "Read-only product and package catalog for X Proposal. "
        "Use recall_catalog with business_unit and queries[] (short concepts from the customer brief). "
        "Dual-path recall returns products and packages with sku_semantic_for_ai / package_semantic_for_ai "
        "for quotation layout and table-split guidance. "
        "Then get_product / get_package / expand_package for drill-down. "
        "When jurisdictions matter, list_jurisdictions then pass jurisdiction on recall_catalog."
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
def recall_catalog(
    business_unit: str,
    queries: list[str],
    jurisdiction: str | None = None,
    department_team: str | None = None,
    limit_products: int = 20,
    limit_packages: int = 20,
) -> dict:
    """
    Dual-path recall: score products and packages for business_unit.

    Pass queries[] as 1–3 word concepts extracted from the customer need (not one long sentence).
    Each hit includes full catalog rows, especially *_semantic_for_ai fields.
    """
    if not queries or not any(q and str(q).strip() for q in queries):
        raise ValueError("queries must contain at least one non-empty concept string.")
    auth = require_auth()
    with session_scope() as session:
        return run_recall_catalog(
            session,
            auth,
            business_unit=business_unit,
            queries=[str(q) for q in queries],
            jurisdiction=jurisdiction,
            department_team=department_team,
            limit_products=limit_products,
            limit_packages=limit_packages,
        )


@catalog_mcp.tool()
def get_product(
    business_unit: str,
    sku: str,
    jurisdiction: str | None = None,
) -> dict:
    """Get one product by SKU (full row including sku_semantic_for_ai)."""
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
def get_package(business_unit: str, package_id: str) -> dict:
    """Get package metadata by id (includes package_semantic_for_ai)."""
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
