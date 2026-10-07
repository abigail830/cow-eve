from __future__ import annotations

from proposal_knowledge.application.jurisdiction_defaults import (
    apply_bu_default_jurisdictions,
    default_jurisdiction_for_business_unit,
    effective_jurisdictions,
    offshore_jurisdiction_for_acorp_sg_product,
)


def test_default_from_acorp_bu_suffix():
    assert default_jurisdiction_for_business_unit("Acorp-SG") == "SG"
    assert default_jurisdiction_for_business_unit("acorp-hk") == "HK"
    assert default_jurisdiction_for_business_unit("Other-BU") is None


def test_effective_prefers_stored_tags():
    assert effective_jurisdictions("Acorp-HK", ["VG"]) == ["VG"]
    assert effective_jurisdictions("Acorp-SG", []) == ["SG"]


def test_apply_on_import_only_when_blank():
    assert apply_bu_default_jurisdictions("Acorp-MY", []) == ["MY"]
    assert apply_bu_default_jurisdictions("Acorp-HK", ["VG"]) == ["VG"]


def test_acorp_sg_offshore_overrides_bu_default():
    assert offshore_jurisdiction_for_acorp_sg_product("CS040B1", None) == "VG"
    assert offshore_jurisdiction_for_acorp_sg_product("CS040C", None) == "KY"
    assert apply_bu_default_jurisdictions("Acorp-SG", [], sku="CS044B", product_name="x") == [
        "VG"
    ]
    assert apply_bu_default_jurisdictions("Acorp-SG", [], sku="CS001", product_name="Local") == [
        "SG"
    ]
