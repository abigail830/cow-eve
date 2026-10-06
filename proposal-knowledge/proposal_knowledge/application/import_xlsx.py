from __future__ import annotations

import re
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from proposal_knowledge.infrastructure.db.models import PackageRow, ProductRow


def parse_jurisdictions(raw: object) -> list[str]:
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []
    parts = re.split(r"[;,|/]+", text)
    return [p.strip() for p in parts if p.strip()]


def parse_linked_skus(raw: object) -> list[str]:
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []
    return [p.strip() for p in text.split(";") if p.strip()]


def import_products_xlsx(session: Session, path: Path) -> int:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows)]
    idx = {name: i for i, name in enumerate(header)}
    count = 0
    for row in rows:
        if not row or not any(row):
            continue
        sku = _cell(row, idx, "SKU*")
        bu = _cell(row, idx, "BU*")
        if not sku or not bu:
            continue
        product = ProductRow(
            business_unit=bu,
            sku=sku,
            product_name=_cell(row, idx, "Product name*") or sku,
            product_description=_cell(row, idx, "Product description"),
            service_name_on_proposal=_cell(row, idx, "Service name on Proposal"),
            scope_of_work=_cell(row, idx, "Scope of Work"),
            sku_semantic_for_ai=_cell(row, idx, "SKU Semantic for AI"),
            billing_frequency=_cell(row, idx, "Billing frequency*"),
            currency=_cell(row, idx, "Currency*"),
            price=_cell(row, idx, "Price"),
            recurring=_cell(row, idx, "Recurring"),
            standard_pricing_matrix=_cell(row, idx, "Standard pricing matrix"),
            department_team=_cell(row, idx, "Department/Team"),
            status=_cell(row, idx, "Status*"),
            jurisdictions=parse_jurisdictions(_cell(row, idx, "Jurisdictions")),
        )
        session.merge(product)
        count += 1
    wb.close()
    return count


def import_packages_xlsx(session: Session, path: Path) -> int:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows)]
    idx = {name: i for i, name in enumerate(header)}
    count = 0
    for row in rows:
        if not row or not any(row):
            continue
        package_id = _cell(row, idx, "ID*")
        bu = _cell(row, idx, "BU*")
        if not package_id or not bu:
            continue
        pkg = PackageRow(
            business_unit=bu,
            package_id=package_id,
            package_name=_cell(row, idx, "Package name*") or package_id,
            package_description=_cell(row, idx, "Package description"),
            package_semantic_for_ai=_cell(row, idx, "Package Semantic for AI"),
            linked_skus=parse_linked_skus(_cell(row, idx, "Linked SKU")),
        )
        session.merge(pkg)
        count += 1
    wb.close()
    return count


def _cell(row: tuple, idx: dict[str, int], col: str) -> str | None:
    i = idx.get(col)
    if i is None or i >= len(row):
        return None
    val = row[i]
    if val is None:
        return None
    text = str(val).strip()
    return text or None
