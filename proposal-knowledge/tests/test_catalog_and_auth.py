from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from proposal_knowledge.application.auth_service import (
    SCOPE_MCP_CATALOG,
    SCOPE_MCP_CV,
    create_api_key_record,
)
from proposal_knowledge.application.import_xlsx import import_packages_xlsx, import_products_xlsx
from proposal_knowledge.config import get_settings
from proposal_knowledge.infrastructure.db.models import PersonRow
from proposal_knowledge.infrastructure.db.session import init_db, session_scope
from proposal_knowledge.interfaces.http.app import create_app

DOCS = Path(__file__).resolve().parents[2] / "docs"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("PROPOSAL_KNOWLEDGE_ADMIN_KEY", "admin-test-key")
    monkeypatch.setenv("API_KEY_HASH_PEPPER", "test-pepper")
    get_settings.cache_clear()
    init_db()

    product_xlsx = DOCS / "INCORP-HK_product_schema_export_20261006T121554Z.xlsx"
    package_xlsx = DOCS / "INCORP-HK_solution_package_export_20261006T121602Z.xlsx"
    if product_xlsx.is_file():
        with session_scope() as session:
            import_products_xlsx(session, product_xlsx)
            import_packages_xlsx(session, package_xlsx)

    with session_scope() as session:
        session.add(
            PersonRow(
                business_unit="INCORP-HK",
                display_name="Alex Example",
                department="Accounting",
                title="Manager",
                bio="Sample bio",
                region="HK",
            )
        )

    with session_scope() as session:
        _, mcp_key = create_api_key_record(
            session,
            label="test",
            scopes=[SCOPE_MCP_CATALOG, SCOPE_MCP_CV],
            allowed_business_units=["INCORP-HK"],
            allow_all_business_units=False,
        )

    with TestClient(create_app()) as c:
        c.mcp_key = mcp_key  # type: ignore[attr-defined]
        yield c
    get_settings.cache_clear()


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_admin_create_api_key(client: TestClient):
    res = client.post(
        "/internal/v1/api-keys",
        headers={"Authorization": "Bearer admin-test-key"},
        json={
            "label": "another",
            "scopes": ["mcp:catalog"],
            "allowed_business_units": ["INCORP-HK"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["api_key"].startswith("pk_live_")


@pytest.mark.skipif(
    not (DOCS / "INCORP-HK_product_schema_export_20261006T121554Z.xlsx").is_file(),
    reason="HK sample xlsx not present",
)
def test_mcp_catalog_initialize(client: TestClient):
    res = client.post(
        "/api/mcp/catalog/mcp",
        headers={
            "Authorization": f"Bearer {client.mcp_key}",
            "Accept": "application/json",
        },
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "0"},
            },
        },
    )
    assert res.status_code not in (401, 403, 404), res.text


def test_catalog_service_import_row_count(client: TestClient):
    with session_scope() as session:
        from proposal_knowledge.application import catalog_service
        from proposal_knowledge.application.auth_service import authorize_bearer

        ctx = authorize_bearer(session, client.mcp_key, SCOPE_MCP_CATALOG)
        units = catalog_service.list_business_units(session, ctx)
        assert any(u["business_unit"] == "INCORP-HK" for u in units)
        products = catalog_service.search_products(
            session,
            ctx,
            business_unit="INCORP-HK",
            query="incorp",
            limit=5,
            jurisdiction="HK",
        )
        assert len(products) >= 1
