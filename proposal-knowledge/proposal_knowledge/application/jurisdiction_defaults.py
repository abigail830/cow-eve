from __future__ import annotations

import re

_ACORP_BU_RE = re.compile(r"^Acorp-([A-Za-z]{2})$", re.IGNORECASE)
# Acorp-SG offshore adhoc SKUs: CS040B / CS041B … (BVI), CS040C … (Cayman)
_ACORP_SG_OFFSHORE_SKU_BVI_RE = re.compile(r"^CS\d+B\d*$", re.IGNORECASE)
_ACORP_SG_OFFSHORE_SKU_CAYMAN_RE = re.compile(r"^CS\d+C\d*$", re.IGNORECASE)


def default_jurisdiction_for_business_unit(business_unit: str) -> str | None:
    """Infer home jurisdiction from Acorp-XX BU when MDM leaves Jurisdictions blank."""
    bu = (business_unit or "").strip()
    m = _ACORP_BU_RE.match(bu)
    if not m:
        return None
    return m.group(1).upper()


def effective_jurisdictions(
    business_unit: str, jurisdictions: list[str] | None
) -> list[str]:
    """Stored tags win; otherwise use BU default (e.g. Acorp-SG → SG)."""
    stored = [str(j).strip() for j in (jurisdictions or []) if j and str(j).strip()]
    if stored:
        return stored
    default = default_jurisdiction_for_business_unit(business_unit)
    return [default] if default else []


def offshore_jurisdiction_for_acorp_sg_product(
    sku: str | None, product_name: str | None
) -> str | None:
    """BVI → VG (same as Acorp-HK offshore rows); Cayman → KY."""
    code = (sku or "").strip()
    if _ACORP_SG_OFFSHORE_SKU_BVI_RE.match(code):
        return "VG"
    if _ACORP_SG_OFFSHORE_SKU_CAYMAN_RE.match(code):
        return "KY"
    name = (product_name or "").lower()
    if "bvi" in name:
        return "VG"
    if "cayman" in name:
        return "KY"
    return None


def apply_bu_default_jurisdictions(
    business_unit: str,
    jurisdictions: list[str],
    *,
    sku: str | None = None,
    product_name: str | None = None,
) -> list[str]:
    """Use on import: MDM blank → BU default, with Acorp-SG offshore overrides."""
    if jurisdictions:
        stored = jurisdictions
    else:
        stored = effective_jurisdictions(business_unit, [])
    if business_unit.strip().lower() == "acorp-sg":
        offshore = offshore_jurisdiction_for_acorp_sg_product(sku, product_name)
        if offshore:
            return [offshore]
    return stored
