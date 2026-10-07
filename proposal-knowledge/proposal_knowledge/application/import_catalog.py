from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from proposal_knowledge.application.jurisdiction_defaults import apply_bu_default_jurisdictions
from proposal_knowledge.application.brand_sanitize import (
    sanitize_business_unit,
    sanitize_free_text,
    sanitize_jurisdictions,
    sanitize_linked_skus,
)
from proposal_knowledge.application.import_xlsx import (
    import_packages_xlsx,
    import_products_xlsx,
    parse_jurisdictions,
    parse_linked_skus,
)
from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow


def import_products_file(
    session: Session, path: Path, *, sanitize_acorp: bool = False
) -> int:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return import_products_xlsx(session, path, sanitize_acorp=sanitize_acorp)
    if suffix == ".csv":
        return _import_products_csv(session, path, sanitize_acorp=sanitize_acorp)
    raise ValueError(f"Unsupported products file type: {suffix} (use .xlsx or .csv)")


def import_packages_file(
    session: Session, path: Path, *, sanitize_acorp: bool = False
) -> int:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return import_packages_xlsx(session, path, sanitize_acorp=sanitize_acorp)
    if suffix == ".csv":
        return _import_packages_csv(session, path, sanitize_acorp=sanitize_acorp)
    raise ValueError(f"Unsupported packages file type: {suffix} (use .xlsx or .csv)")


def import_catalog_pair(
    session: Session,
    *,
    products_path: Path,
    packages_path: Path,
    sanitize_acorp: bool = False,
) -> tuple[int, int]:
    n_products = import_products_file(
        session, products_path, sanitize_acorp=sanitize_acorp
    )
    n_packages = import_packages_file(
        session, packages_path, sanitize_acorp=sanitize_acorp
    )
    return n_products, n_packages


def purge_business_units_by_prefix(session: Session, prefix: str) -> tuple[int, int]:
    """Remove catalog rows whose business_unit starts with prefix (case-sensitive)."""
    from sqlalchemy import delete

    pref = prefix.strip()
    if not pref:
        return 0, 0
    pat = f"{pref}%"
    n_prod = session.execute(
        delete(ProductRow).where(ProductRow.business_unit.like(pat))
    ).rowcount
    n_pkg = session.execute(
        delete(PackageRow).where(PackageRow.business_unit.like(pat))
    ).rowcount
    return int(n_prod or 0), int(n_pkg or 0)


def _maybe(raw: str | None, sanitize_acorp: bool) -> str | None:
    if not sanitize_acorp or raw is None:
        return raw
    return sanitize_free_text(raw)


def _import_products_csv(session: Session, path: Path, *, sanitize_acorp: bool = False) -> int:
    count = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = _csv_cell(row, "SKU*")
            bu = _csv_cell(row, "BU*")
            if not sku or not bu:
                continue
            if sanitize_acorp:
                bu = sanitize_business_unit(bu)
                sku = _maybe(sku, True) or sku
            product_name = (
                _maybe(_csv_cell(row, "Product name*") or sku, sanitize_acorp) or sku
            )
            product = ProductRow(
                business_unit=bu,
                sku=sku,
                product_name=product_name,
                product_description=_maybe(
                    _csv_cell(row, "Product description"), sanitize_acorp
                ),
                service_name_on_proposal=_maybe(
                    _csv_cell(row, "Service name on Proposal"), sanitize_acorp
                ),
                scope_of_work=_maybe(_csv_cell(row, "Scope of Work"), sanitize_acorp),
                sku_semantic_for_ai=_maybe(
                    _csv_cell(row, "SKU Semantic for AI"), sanitize_acorp
                ),
                billing_frequency=_maybe(
                    _csv_cell(row, "Billing frequency*"), sanitize_acorp
                ),
                currency=_maybe(_csv_cell(row, "Currency*"), sanitize_acorp),
                price=_maybe(_csv_cell(row, "Price"), sanitize_acorp),
                recurring=_maybe(_csv_cell(row, "Recurring"), sanitize_acorp),
                standard_pricing_matrix=_maybe(
                    _csv_cell(row, "Standard pricing matrix"), sanitize_acorp
                ),
                department_team=_maybe(_csv_cell(row, "Department/Team"), sanitize_acorp),
                status=_maybe(_csv_cell(row, "Status*"), sanitize_acorp),
                jurisdictions=apply_bu_default_jurisdictions(
                    bu,
                    parse_jurisdictions(
                        _csv_cell(row, "Jurisdictions"), sanitize_acorp=sanitize_acorp
                    ),
                    sku=sku,
                    product_name=product_name,
                ),
            )
            session.merge(product)
            count += 1
    return count


def _import_packages_csv(session: Session, path: Path, *, sanitize_acorp: bool = False) -> int:
    count = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            package_id = _csv_cell(row, "ID*")
            bu = _csv_cell(row, "BU*")
            if not package_id or not bu:
                continue
            if sanitize_acorp:
                bu = sanitize_business_unit(bu)
                package_id = _maybe(package_id, True) or package_id
            pkg = PackageRow(
                business_unit=bu,
                package_id=package_id,
                package_name=_maybe(
                    _csv_cell(row, "Package name*") or package_id, sanitize_acorp
                )
                or package_id,
                package_description=_maybe(
                    _csv_cell(row, "Package description"), sanitize_acorp
                ),
                package_semantic_for_ai=_maybe(
                    _csv_cell(row, "Package Semantic for AI"), sanitize_acorp
                ),
                linked_skus=parse_linked_skus(
                    _csv_cell(row, "Linked SKU"), sanitize_acorp=sanitize_acorp
                ),
            )
            session.merge(pkg)
            count += 1
    return count


def _csv_cell(row: dict[str, str | None], col: str) -> str | None:
    val = row.get(col)
    if val is None:
        return None
    text = str(val).strip()
    return text or None
