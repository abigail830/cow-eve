from __future__ import annotations

from proposal_knowledge.application.catalog_recall import recall_catalog, tokenize_queries
from proposal_knowledge.application.auth_service import SCOPE_MCP_CATALOG, create_api_key_record
from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow
from proposal_knowledge.infrastructure.db.session import init_db, session_scope


def test_tokenize_splits_phrases():
    assert tokenize_queries(["bookkeeping accounting", "CS"]) == [
        "bookkeeping",
        "accounting",
        "cs",
    ]


def test_recall_matches_semantic_and_returns_fields(tmp_path, monkeypatch):
    db_path = tmp_path / "recall.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("API_KEY_HASH_PEPPER", "test-pepper")
    from proposal_knowledge.config import get_settings

    get_settings.cache_clear()
    init_db()

    with session_scope() as session:
        session.add(
            ProductRow(
                business_unit="Acorp-SG",
                sku="CS002",
                product_name="Incorp",
                service_name_on_proposal="Company incorporation",
                sku_semantic_for_ai="One-off entity setup; split fee table row A",
                scope_of_work="Name search and registration",
                status="active",
                jurisdictions=["SG"],
            )
        )
        session.add(
            ProductRow(
                business_unit="Acorp-SG",
                sku="BK001",
                product_name="Bookkeeping",
                sku_semantic_for_ai="Monthly accounting; recurring row",
                scope_of_work="Bookkeeping and accounting reports",
                status="active",
                jurisdictions=["SG"],
            )
        )
        session.add(
            PackageRow(
                business_unit="Acorp-SG",
                package_id="suite-sme",
                package_name="SME suite",
                package_semantic_for_ai="Full suite; use package quotation block",
                linked_skus=["CS002", "BK001"],
            )
        )
        _, _key = create_api_key_record(
            session,
            label="t",
            scopes=[SCOPE_MCP_CATALOG],
            allowed_business_units=["Acorp-SG"],
            allow_all_business_units=False,
        )
        from proposal_knowledge.application.auth_service import authorize_bearer

        auth = authorize_bearer(session, _key, SCOPE_MCP_CATALOG)
        result = recall_catalog(
            session,
            auth,
            business_unit="Acorp-SG",
            queries=["bookkeeping", "accounting"],
            jurisdiction="SG",
            limit_products=10,
            limit_packages=5,
        )

    assert "bookkeeping" in result["tokens"]
    assert len(result["products"]) >= 1
    bk = next(p for p in result["products"] if p["sku"] == "BK001")
    assert bk["sku_semantic_for_ai"] is not None
    assert "Monthly accounting" in bk["sku_semantic_for_ai"]
    assert result["paths"] == ["products", "packages"]


def test_recall_infers_jurisdiction_from_bu_when_field_empty(tmp_path, monkeypatch):
    db_path = tmp_path / "recall-empty-j.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("API_KEY_HASH_PEPPER", "test-pepper")
    from proposal_knowledge.config import get_settings

    get_settings.cache_clear()
    init_db()

    with session_scope() as session:
        session.add(
            ProductRow(
                business_unit="Acorp-SG",
                sku="BK-EMPTY-J",
                product_name="Bookkeeping",
                sku_semantic_for_ai="Monthly accounting",
                status="active",
                jurisdictions=[],
            )
        )
        session.flush()
        _, _key = create_api_key_record(
            session,
            label="t",
            scopes=[SCOPE_MCP_CATALOG],
            allowed_business_units=["Acorp-SG"],
            allow_all_business_units=False,
        )
        from proposal_knowledge.application.auth_service import authorize_bearer

        auth = authorize_bearer(session, _key, SCOPE_MCP_CATALOG)
        result = recall_catalog(
            session,
            auth,
            business_unit="Acorp-SG",
            queries=["bookkeeping"],
            jurisdiction="SG",
            limit_products=10,
        )

    assert any(p["sku"] == "BK-EMPTY-J" for p in result["products"])
