# Layout: simplified_billing_frequency (default)

**Display name:** Simplified billing frequency quotation

Visual reference (optional): `assets/malaysia-example.png`

One fee column + one billing-frequency / occurrence column.

## Columns

| Column (canonical) | UI label aliases | Purpose |
|--------------------|------------------|---------|
| Service / Scope | Service, Accounting & Bookkeeping, … | Category heading + nested bullets + notes |
| Fee | Fee, Fee(USD), Fee(MYR), … | Professional fee, exclusions, conditional fee text; currency from proposal |
| Billing frequency | Billing Frequency, Occurrence | e.g. Monthly / once-off / annual / blank / “Based on up to N transactions…” |

## Typical section title

Package display name, or a service-mix suggested title (editable). Examples: `Acorp CS bundle`, `Accounting & Bookkeeping (new)`.

## Row JSON shape

```json
{
  "row_id": "r-1",
  "source_type": "business_case",
  "source_id": "Acorp / Secretarial Service* Acorp CS bundle",
  "is_custom": false,
  "title": "Acorp",
  "scope_bullets": [
    "Name search: Limited to two (2) name searches.",
    "Appointment of up to three (3) directors and three (3) shareholders."
  ],
  "notes": [
    "If Acorp setup is aborted after name search, a time-cost fee may apply."
  ],
  "fees": {
    "amount": 3000,
    "currency": "MYR",
    "display": "RM 3,000",
    "exclusions": ["Fee excludes government registration fees."],
    "conditional_fee_notes": []
  },
  "billing_frequency": "once-off"
}
```

When the fee is basis text rather than a number (same layout; occurrence may carry the basis):

```json
{
  "row_id": "vn-2",
  "source_type": "sku",
  "source_id": "VN-BK-001",
  "is_custom": false,
  "title": "Monthly Bookkeeping and Reporting Under VAS",
  "scope_bullets": [
    "Up to 30 transactions per month",
    "Posting into accounting software compliant with VAS",
    "Prepare statutory monthly/quarterly/yearly VAS reports"
  ],
  "fees": {
    "amount": null,
    "currency": "USD",
    "display": "Based on up to 30 transactions per month"
  },
  "billing_frequency": "Monthly"
}
```

`billing_frequency` may be `null` / blank when not applicable (e.g. nominee services with TBD fees).

## Mapping from catalog

| Catalog | Layout field |
|---------|--------------|
| Package name | `section_title` |
| SKU scope bullets | `scope_bullets` |
| Headline fee | `fees.amount` / `display` |
| Gov / third-party fees | `fees.exclusions` |
| Contingency text | `notes` |
| Cadence / occurrence | `billing_frequency` |
