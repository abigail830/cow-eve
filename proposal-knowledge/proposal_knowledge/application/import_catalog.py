from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from proposal_knowledge.application.import_xlsx import (
    import_packages_xlsx,
    import_products_xlsx,
    parse_jurisdictions,
    parse_linked_skus,
)
from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow


def import_products_file(session: Session, path: Path) -> int:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return import_products_xlsx(session, path)
    if suffix == ".csv":
        return _import_products_csv(session, path)
    raise ValueError(f"Unsupported products file type: {suffix} (use .xlsx or .csv)")


def import_packages_file(session: Session, path: Path) -> int:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return import_packages_xlsx(session, path)
    if suffix == ".csv":
        return _import_packages_csv(session, path)
    raise ValueError(f"Unsupported packages file type: {suffix} (use .xlsx or .csv)")


def import_catalog_pair(
    session: Session, *, products_path: Path, packages_path: Path
) -> tuple[int, int]:
    n_products = import_products_file(session, products_path)
    n_packages = import_packages_file(session, packages_path)
    return n_products, n_packages


def _import_products_csv(session: Session, path: Path) -> int:
    count = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = _csv_cell(row, "SKU*")
            bu = _csv_cell(row, "BU*")
            if not sku or not bu:
                continue
            product = ProductRow(
                business_unit=bu,
                sku=sku,
                product_name=_csv_cell(row, "Product name*") or sku,
                product_description=_csv_cell(row, "Product description"),
                service_name_on_proposal=_csv_cell(row, "Service name on Proposal"),
                scope_of_work=_csv_cell(row, "Scope of Work"),
                sku_semantic_for_ai=_csv_cell(row, "SKU Semantic for AI"),
                billing_frequency=_csv_cell(row, "Billing frequency*"),
                currency=_csv_cell(row, "Currency*"),
                price=_csv_cell(row, "Price"),
                recurring=_csv_cell(row, "Recurring"),
                standard_pricing_matrix=_csv_cell(row, "Standard pricing matrix"),
                department_team=_csv_cell(row, "Department/Team"),
                status=_csv_cell(row, "Status*"),
                jurisdictions=parse_jurisdictions(_csv_cell(row, "Jurisdictions")),
            )
            session.merge(product)
            count += 1
    return count


def _import_packages_csv(session: Session, path: Path) -> int:
    count = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            package_id = _csv_cell(row, "ID*")
            bu = _csv_cell(row, "BU*")
            if not package_id or not bu:
                continue
            pkg = PackageRow(
                business_unit=bu,
                package_id=package_id,
                package_name=_csv_cell(row, "Package name*") or package_id,
                package_description=_csv_cell(row, "Package description"),
                package_semantic_for_ai=_csv_cell(row, "Package Semantic for AI"),
                linked_skus=parse_linked_skus(_csv_cell(row, "Linked SKU")),
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
