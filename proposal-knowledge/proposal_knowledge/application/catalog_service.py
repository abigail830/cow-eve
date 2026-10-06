from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from proposal_knowledge.domain.auth import AuthorizedContext
from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow


def _active_status(status: str | None) -> bool:
    if status is None:
        return True
    s = status.strip().lower()
    return s in ("1", "active", "true", "yes")


def list_business_units(session: Session, auth: AuthorizedContext) -> list[dict]:
    product_bus = select(ProductRow.business_unit).distinct()
    package_bus = select(PackageRow.business_unit).distinct()
    union_q = product_bus.union(package_bus).subquery()
    rows = session.execute(select(union_q.c.business_unit)).scalars().all()
    out: list[dict] = []
    for bu in sorted(rows):
        if not auth.allows_business_unit(bu):
            continue
        pc = session.scalar(
            select(func.count())
            .select_from(ProductRow)
            .where(ProductRow.business_unit == bu)
        )
        pk = session.scalar(
            select(func.count())
            .select_from(PackageRow)
            .where(PackageRow.business_unit == bu)
        )
        out.append(
            {
                "business_unit": bu,
                "product_count": int(pc or 0),
                "package_count": int(pk or 0),
            }
        )
    return out


def list_jurisdictions(session: Session, auth: AuthorizedContext, business_unit: str) -> list[str]:
    auth.require_business_unit(business_unit)
    rows = session.scalars(
        select(ProductRow.jurisdictions).where(ProductRow.business_unit == business_unit)
    ).all()
    found: set[str] = set()
    for arr in rows:
        for j in arr or []:
            j = str(j).strip()
            if j:
                found.add(j)
    return sorted(found)


def _matches_jurisdiction(jurisdictions: list[str] | None, jurisdiction: str | None) -> bool:
    if not jurisdiction or not jurisdiction.strip():
        return True
    return jurisdiction.strip() in (jurisdictions or [])


def search_products(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    query: str,
    limit: int = 25,
    jurisdiction: str | None = None,
    department_team: str | None = None,
) -> list[dict]:
    auth.require_business_unit(business_unit)
    limit = max(1, min(limit, 50))
    q = query.strip().lower()
    stmt = select(ProductRow).where(ProductRow.business_unit == business_unit)
    if department_team and department_team.strip():
        stmt = stmt.where(
            ProductRow.department_team.ilike(f"%{department_team.strip()}%")
        )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                ProductRow.sku.ilike(like),
                ProductRow.product_name.ilike(like),
                ProductRow.service_name_on_proposal.ilike(like),
                ProductRow.scope_of_work.ilike(like),
            )
        )
    fetch_limit = limit * 4 if jurisdiction and jurisdiction.strip() else limit
    rows = session.scalars(stmt.limit(fetch_limit)).all()
    out: list[dict] = []
    for r in rows:
        if not _active_status(r.status):
            continue
        if not _matches_jurisdiction(r.jurisdictions, jurisdiction):
            continue
        out.append(_product_dict(r))
        if len(out) >= limit:
            break
    return out


def get_product(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    sku: str,
    jurisdiction: str | None = None,
) -> dict:
    auth.require_business_unit(business_unit)
    row = session.get(ProductRow, {"business_unit": business_unit, "sku": sku})
    if row is None:
        raise LookupError("Product not found.")
    if jurisdiction and jurisdiction.strip():
        j = jurisdiction.strip()
        if j not in (row.jurisdictions or []):
            raise ValueError(
                f"Product does not apply to jurisdiction {j!r}. "
                f"Available: {row.jurisdictions or []}"
            )
    return _product_dict(row)


def search_packages(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    query: str,
    limit: int = 25,
    jurisdiction: str | None = None,
) -> list[dict]:
    auth.require_business_unit(business_unit)
    limit = max(1, min(limit, 50))
    like = f"%{query.strip()}%" if query.strip() else None
    stmt = select(PackageRow).where(PackageRow.business_unit == business_unit)
    if like:
        stmt = stmt.where(
            or_(
                PackageRow.package_id.ilike(like),
                PackageRow.package_name.ilike(like),
            )
        )
    packages = session.scalars(stmt.limit(limit * 3)).all()
    out: list[dict] = []
    for pkg in packages:
        if jurisdiction and jurisdiction.strip():
            if not _package_covers_jurisdiction(
                session, business_unit, pkg, jurisdiction.strip()
            ):
                continue
        out.append(_package_dict(pkg))
        if len(out) >= limit:
            break
    return out


def get_package(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    package_id: str,
) -> dict:
    auth.require_business_unit(business_unit)
    row = session.get(PackageRow, {"business_unit": business_unit, "package_id": package_id})
    if row is None:
        raise LookupError("Package not found.")
    return _package_dict(row)


def expand_package(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    package_id: str,
    jurisdiction: str | None = None,
) -> dict:
    pkg = get_package(session, auth, business_unit=business_unit, package_id=package_id)
    j_filter = jurisdiction.strip() if jurisdiction and jurisdiction.strip() else None
    lines: list[dict] = []
    for sku in pkg["linked_skus"]:
        prod = session.get(ProductRow, {"business_unit": business_unit, "sku": sku})
        if prod is None:
            lines.append(
                {
                    "sku": sku,
                    "missing_in_catalog": True,
                    "jurisdiction_covers": None,
                }
            )
            continue
        covers = None
        if j_filter:
            covers = j_filter in (prod.jurisdictions or [])
        lines.append(
            {
                "sku": sku,
                "service_name_on_proposal": prod.service_name_on_proposal,
                "jurisdictions": prod.jurisdictions or [],
                "jurisdiction_covers": covers,
                "standard_pricing_matrix": prod.standard_pricing_matrix,
                "currency": prod.currency,
            }
        )
    return {"package": pkg, "lines": lines}


def _package_covers_jurisdiction(
    session: Session, business_unit: str, pkg: PackageRow, jurisdiction: str
) -> bool:
    for sku in pkg.linked_skus or []:
        prod = session.get(ProductRow, {"business_unit": business_unit, "sku": sku})
        if prod and jurisdiction in (prod.jurisdictions or []):
            return True
    return False


def _product_dict(row: ProductRow) -> dict:
    return {
        "business_unit": row.business_unit,
        "sku": row.sku,
        "product_name": row.product_name,
        "product_description": row.product_description,
        "service_name_on_proposal": row.service_name_on_proposal,
        "scope_of_work": _truncate(row.scope_of_work, 4000),
        "sku_semantic_for_ai": row.sku_semantic_for_ai,
        "billing_frequency": row.billing_frequency,
        "currency": row.currency,
        "price": row.price,
        "recurring": row.recurring,
        "standard_pricing_matrix": row.standard_pricing_matrix,
        "department_team": row.department_team,
        "status": row.status,
        "jurisdictions": row.jurisdictions or [],
    }


def _package_dict(row: PackageRow) -> dict:
    return {
        "business_unit": row.business_unit,
        "package_id": row.package_id,
        "package_name": row.package_name,
        "package_description": row.package_description,
        "package_semantic_for_ai": row.package_semantic_for_ai,
        "linked_skus": row.linked_skus or [],
    }


def _truncate(text: str | None, max_len: int) -> str | None:
    if text is None:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
