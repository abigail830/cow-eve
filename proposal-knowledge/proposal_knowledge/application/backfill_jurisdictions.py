from __future__ import annotations

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from proposal_knowledge.application.jurisdiction_defaults import (
    default_jurisdiction_for_business_unit,
    offshore_jurisdiction_for_acorp_sg_product,
)

ACORP_SG = "Acorp-SG"
from proposal_knowledge.infrastructure.db.models import ProductRow


def backfill_empty_product_jurisdictions(
    session: Session, *, apply: bool = False
) -> dict[str, int]:
    """Set jurisdictions=[XX] for Acorp-XX rows where MDM left Jurisdictions blank."""
    stats: Counter[str] = Counter()
    rows = session.scalars(select(ProductRow)).all()
    for row in rows:
        if row.jurisdictions:
            stats["skipped_already_tagged"] += 1
            continue
        default = default_jurisdiction_for_business_unit(row.business_unit)
        if not default:
            stats["skipped_no_bu_default"] += 1
            continue
        stats[f"fill_{default}"] += 1
        stats[f"bu_{row.business_unit}"] += 1
        if apply:
            row.jurisdictions = [default]
    return dict(stats)


def patch_acorp_sg_offshore_jurisdictions(
    session: Session, *, apply: bool = False
) -> dict[str, int]:
    """Set VG/KY on Acorp-SG BVI/Cayman SKUs (CS*B / CS*C and name hints)."""
    stats: Counter[str] = Counter()
    rows = session.scalars(
        select(ProductRow).where(ProductRow.business_unit == ACORP_SG)
    ).all()
    for row in rows:
        target = offshore_jurisdiction_for_acorp_sg_product(row.sku, row.product_name)
        if not target:
            stats["skipped_not_offshore"] += 1
            continue
        current = [str(j).strip().upper() for j in (row.jurisdictions or []) if j]
        if current == [target]:
            stats["skipped_already_correct"] += 1
            continue
        stats[f"patch_{target}"] += 1
        if apply:
            row.jurisdictions = [target]
    return dict(stats)
