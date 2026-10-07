from proposal_knowledge.application.brand_sanitize import (
    sanitize_business_unit,
    sanitize_free_text,
)


def test_sanitize_business_unit():
    assert sanitize_business_unit("INCORP-HK") == "Acorp-HK"
    assert sanitize_business_unit("incorp-au") == "Acorp-au"


def test_sanitize_free_text_sow():
    raw = "INCORP-HK provides incorporation. Contact incorp team."
    out = sanitize_free_text(raw)
    assert out is not None
    assert "Acorp-HK" in out
    assert "incorp" not in out.lower() or "Acorp" in out
