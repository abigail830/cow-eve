from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from proposal_knowledge.domain.auth import AuthorizedContext
from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow

from proposal_knowledge.application import catalog_service

_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)

# Recall scoring (axon dual-path: breadth then LLM rerank on SOW + semantic hints)
_PRODUCT_FIELD_WEIGHTS: tuple[tuple[str, int], ...] = (
    ("sku_semantic_for_ai", 4),
    ("scope_of_work", 3),
    ("service_name_on_proposal", 2),
    ("product_name", 2),
    ("product_description", 2),
    ("sku", 1),
)

_PACKAGE_FIELD_WEIGHTS: tuple[tuple[str, int], ...] = (
    ("package_semantic_for_ai", 4),
    ("package_name", 2),
    ("package_description", 2),
    ("package_id", 1),
)


def tokenize_queries(queries: list[str]) -> list[str]:
    seen: set[str] = set()
    tokens: list[str] = []
    for raw in queries:
        for match in _TOKEN_RE.finditer(raw.lower()):
            t = match.group(0)
            if len(t) < 2:
                continue
            if t in seen:
                continue
            seen.add(t)
            tokens.append(t)
    return tokens


def _row_text(row: ProductRow | PackageRow, field: str) -> str:
    val = getattr(row, field, None)
    if val is None:
        return ""
    return str(val).lower()


def _score_row(
    row: ProductRow | PackageRow,
    tokens: list[str],
    field_weights: tuple[tuple[str, int], ...],
) -> tuple[int, list[str]]:
    if not tokens:
        return 0, []
    score = 0
    matched: set[str] = set()
    for field, weight in field_weights:
        hay = _row_text(row, field)
        if not hay:
            continue
        for token in tokens:
            if token in hay:
                score += weight
                matched.add(token)
    return score, sorted(matched)


def _product_sql_candidates(
    session: Session,
    business_unit: str,
    tokens: list[str],
    department_team: str | None,
    fetch_limit: int,
) -> list[ProductRow]:
    stmt = select(ProductRow).where(ProductRow.business_unit == business_unit)
    if department_team and department_team.strip():
        stmt = stmt.where(
            ProductRow.department_team.ilike(f"%{department_team.strip()}%")
        )
    if tokens:
        clauses = []
        for token in tokens:
            like = f"%{token}%"
            clauses.append(ProductRow.sku.ilike(like))
            clauses.append(ProductRow.product_name.ilike(like))
            clauses.append(ProductRow.service_name_on_proposal.ilike(like))
            clauses.append(ProductRow.product_description.ilike(like))
            clauses.append(ProductRow.scope_of_work.ilike(like))
            clauses.append(ProductRow.sku_semantic_for_ai.ilike(like))
        stmt = stmt.where(or_(*clauses))
    return list(session.scalars(stmt.limit(fetch_limit)).all())


def _package_sql_candidates(
    session: Session,
    business_unit: str,
    tokens: list[str],
    fetch_limit: int,
) -> list[PackageRow]:
    stmt = select(PackageRow).where(PackageRow.business_unit == business_unit)
    if tokens:
        clauses = []
        for token in tokens:
            like = f"%{token}%"
            clauses.append(PackageRow.package_id.ilike(like))
            clauses.append(PackageRow.package_name.ilike(like))
            clauses.append(PackageRow.package_description.ilike(like))
            clauses.append(PackageRow.package_semantic_for_ai.ilike(like))
        stmt = stmt.where(or_(*clauses))
    return list(session.scalars(stmt.limit(fetch_limit)).all())


@dataclass
class ScoredProduct:
    score: int
    matched_tokens: list[str]
    product: dict


@dataclass
class ScoredPackage:
    score: int
    matched_tokens: list[str]
    package: dict


def recall_catalog(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    queries: list[str],
    jurisdiction: str | None = None,
    department_team: str | None = None,
    limit_products: int = 20,
    limit_packages: int = 20,
) -> dict:
    """
    Dual-path catalog recall (packages + products) for one BU.

    Agent supplies short concept queries (from SOW); PK tokenizes, scores, and
    returns full rows including *_semantic_for_ai for downstream quotation logic.
    """
    auth.require_business_unit(business_unit)
    limit_products = max(1, min(limit_products, 50))
    limit_packages = max(1, min(limit_packages, 50))

    cleaned_queries = [q.strip() for q in queries if q and q.strip()]
    tokens = tokenize_queries(cleaned_queries)

    fetch_cap = max(limit_products, limit_packages) * 8
    product_rows = _product_sql_candidates(
        session,
        business_unit,
        tokens,
        department_team,
        fetch_limit=fetch_cap,
    )
    package_rows = _package_sql_candidates(
        session,
        business_unit,
        tokens,
        fetch_limit=fetch_cap,
    )

    scored_products: list[ScoredProduct] = []
    for row in product_rows:
        if not catalog_service._active_status(row.status):
            continue
        if not catalog_service._matches_jurisdiction(
            row.business_unit, row.jurisdictions, jurisdiction
        ):
            continue
        score, matched = _score_row(row, tokens, _PRODUCT_FIELD_WEIGHTS)
        if tokens and score == 0:
            continue
        scored_products.append(
            ScoredProduct(
                score=score,
                matched_tokens=matched,
                product=catalog_service._product_dict(row),
            )
        )
    scored_products.sort(key=lambda x: (-x.score, x.product.get("sku", "")))
    scored_products = scored_products[:limit_products]

    scored_packages: list[ScoredPackage] = []
    for pkg in package_rows:
        if jurisdiction and jurisdiction.strip():
            if not catalog_service._package_covers_jurisdiction(
                session,
                business_unit,
                pkg,
                jurisdiction.strip(),
            ):
                continue
        score, matched = _score_row(pkg, tokens, _PACKAGE_FIELD_WEIGHTS)
        if tokens and score == 0:
            continue
        scored_packages.append(
            ScoredPackage(
                score=score,
                matched_tokens=matched,
                package=catalog_service._package_dict(pkg),
            )
        )
    scored_packages.sort(key=lambda x: (-x.score, x.package.get("package_id", "")))
    scored_packages = scored_packages[:limit_packages]

    candidates: list[dict] = []
    for sp in scored_products:
        candidates.append(
            {
                "candidate_type": "product",
                "recall_score": sp.score,
                "matched_tokens": sp.matched_tokens,
                "product": sp.product,
            }
        )
    for sp in scored_packages:
        candidates.append(
            {
                "candidate_type": "package",
                "recall_score": sp.score,
                "matched_tokens": sp.matched_tokens,
                "package": sp.package,
            }
        )
    candidates.sort(
        key=lambda c: (
            -int(c.get("recall_score") or 0),
            c.get("candidate_type") or "",
        )
    )

    return {
        "business_unit": business_unit,
        "queries": cleaned_queries,
        "tokens": tokens,
        "jurisdiction": jurisdiction.strip() if jurisdiction and jurisdiction.strip() else None,
        "paths": ["products", "packages"],
        "products": [sp.product for sp in scored_products],
        "packages": [sp.package for sp in scored_packages],
        "candidates": candidates,
    }
