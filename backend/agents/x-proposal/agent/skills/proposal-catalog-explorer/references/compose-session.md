# Compose session — truth layers and quotation rows

Internal model for **this chat’s proposal draft**. Sales copy lives in chat and markdown sections; this file describes **what persists between turns** and how it relates to the verified catalog.

## Truth layers (do not collapse)

| Layer | Role | Mutated how |
|-------|------|-------------|
| **Verified catalog** | List prices, SOW, package membership, `*_semantic_for_ai` | Read-only via proposal-catalog MCP |
| **Compose session** | What this deal **selected** (lines, client facts, blueprint, layout family) | Compose tools only (`proposal_init_compose`, `proposal_write_compose_file`) |
| **Derived totals** | GST / first invoice from current quotation rows | Extension compute (reads quotation; writes extensions output) |
| **Narrative sections** | Executive summary, SOS, snippets | Markdown in session; assembled per **proposal-blueprints** playbooks |

Catalog answers *what we could sell and for how much*. Compose answers *what we put on this quote*. Extensions answer *what the first bill looks like given those rows*. Narrative answers *how the client reads scope*.

## Session artifacts (under `/workspace/proposal/`)

| Artifact | Purpose |
|----------|---------|
| `meta.json` | Blueprint, tier, business unit, enabled extensions, layout default |
| `quotation.json` | Fee table **source of truth** for pricing lines |
| `client.json` | Client / entity fields for letter and compliance blocks |
| `scope_of_services.md`, `executive_summary.md`, … | Client-facing narrative (blueprint graph order) |
| `extensions/*.json` | **Outputs** of deterministic math — not a place to invent prices |

Learn row shapes here; do not reverse-engineer compute by searching the filesystem.

## One commercial line, two serializations

Pick **one style per quotation** (from `meta.json` / blueprint default + `quotation-layout-registry.md`):

### A — Compact rows (fast Tier A, simple tables)

Use when the layout family is `one_off_recurring` or you intentionally keep rows minimal.

```json
{
  "currency": "SGD",
  "layout": "one_off_recurring",
  "rows": [
    {
      "sku": "…",
      "displayName": "Company incorporation",
      "oneOff": 1200,
      "recurringAnnual": 0,
      "billingFrequency": "once-off",
      "source": "catalog",
      "isCustom": false
    }
  ]
}
```

### B — Layout rows (default SG SME: `simplified_billing_frequency`)

Use when the fee table needs scope bullets, notes, and explicit fee + billing columns.

See `quotation-layout-simplified-billing-frequency.md` for full column semantics. Priced fields for math:

- `fees.amount` (number, ex-GST professional fee for that row)
- `billing_frequency` (`once-off`, `monthly`, `annual`, …)

Persist `scope_bullets`, `title`, and catalog linkage (`source_id`, `source_type`) for export and SOS — they do not replace `fees.amount` for totals.

## Catalog → quotation row (after match commit)

Map **PK product** fields (from `get_product` / recall hits) into the serialization you chose. Never invent SKU or amount.

| Catalog signal | Compact row | Layout row (`simplified_billing_frequency`) |
|----------------|-------------|-----------------------------------------------|
| `service_name_on_proposal` or `product_name` | `displayName` / `title` | `title` |
| `sku` | `sku` (internal) | `source_id` when `source_type` is `sku` |
| `price` (numeric one-off) | `oneOff` | `fees.amount` when billing is once-off |
| `recurring` + `billing_frequency` | `recurringAnnual` + `billingFrequency` (normalize spelling) | `fees.amount` + `billing_frequency` |
| `currency` | quotation-level `currency` | `fees.currency` |
| `scope_of_work` | optional short note in chat only | `scope_bullets` (split deliverables; do not paraphrase away obligations) |
| `sku_semantic_for_ai` | keep on row metadata if needed for split rows | use for **row split** when semantic says one SKU → multiple table blocks |

**Packages:** `expand_package` → **one row per committed member service** (or one package block if blueprint/layout demands). Package identity: `source_type: business_case`, `source_id` = package id or display name per layout spec.

**Custom / KB gap:** `isCustom: true`, `source: kb_candidate`, `priceStatus: unverified` until the rep confirms.

If a row has no mappable numeric fee from catalog, leave it unpriced and resolve via HITL. **`proposal_compute_extension`** returns **`pricingGuide`** when rows are not recognized — rewrite from that guide; the compute layer does not scan arbitrary fee key names.

## Layout selection (feeds serialization)

1. User asks for a **structure** (matrix, one-off/recurring, simplified occurrence table)
2. Else catalog / blueprint hint
3. Default **`simplified_billing_frequency`** → prefer **layout rows (B)**

Set `quotation.json` `layout` to the registry id. Changing layout may require reshaping rows — reshape using this doc, not ad hoc keys.

## Handoff to narrative (proposal-blueprints)

When **`quotation.json` rows change**, scope narrative is **stale** until SOS is regenerated per `playbooks/sow-to-sos.md` and `references/narrative-assembly.md`.

Catalog skill owns **lines and prices**; blueprint skill owns **how those lines become SOS and section order**.

## Persistence discipline

- Write quotation and related JSON/markdown through **`proposal_write_compose_file`**.
- After material line changes, run extension compute when the blueprint enables first-invoice/GST — totals in chat must match derived output.
- Read this reference and the layout spec **via `load_skill` → `read_file` on skill references**, not host path discovery.
