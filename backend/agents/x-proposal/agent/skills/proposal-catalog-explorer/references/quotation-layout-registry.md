# Quotation layout registry

Universal **structure families** — **not** ACL-gated and **not** region-bound. Product/package data remains ACL-filtered by the platform. Region preferred layout is a **catalog-query hint**, not part of layout identity.

## Built-in layouts

| layout_id | Display name | Columns (summary) | Spec file (`read_skill_resource`) | Example asset |
|-----------|--------------|-------------------|-----------------------------------|---------------|
| `simplified_billing_frequency` | Simplified billing frequency quotation | Service · Fee · Billing Frequency / Occurrence | `references/quotation-layout-simplified-billing-frequency.md` | `assets/malaysia-example.png` |
| `one_off_recurring` | One-off / recurring quotation | Scope · One-off Fee · Recurring Fee | `references/quotation-layout-one-off-recurring.md` | `assets/singapore-example.png` |
| `multi_billing_frequency_matrix` | Multi-billing frequency matrix quotation | Scope · Monthly · Quarterly · Annual · Once-off · Total | `references/quotation-layout-multi-billing-frequency-matrix.md` | `assets/philippines-australia-example.png` |
| `custom` | User-defined | Whatever columns the user describes | (inline in state) | — |

**Default when unspecified:** `simplified_billing_frequency`.

**Important:** Keep layout specs as **flat files** under `references/` (and screenshots under skill-root `assets/`). Nested folders are not discovered by MAF.

## Legacy aliases (compat)

| Old `layout_id` | Resolve to |
|-----------------|------------|
| `malaysia` | `simplified_billing_frequency` |
| `singapore` | `one_off_recurring` |
| `philippines_australia` | `multi_billing_frequency_matrix` |

When reading package `default_layout` or existing state, normalize aliases to the new IDs before patching. Prefer writing the **new** IDs into state. Do not load separate files for aliases — specs are the family files above.

Region → preferred layout lives in **package-catalog-explorer** (`package-index.md` / seed `default_layout`), used only when querying that region's catalog.

## Selection order

1. Explicit user request by **structure** (“one-off/recurring”, “matrix”, “simplified / Occurrence table”) or legacy nicknames (“新加坡格式” → `one_off_recurring`)
2. Catalog hint from the region query: package `default_layout` or region `preferred_layout` (resolve aliases)
3. Fallback: **`simplified_billing_frequency`**

Any region may use any layout if the user asks.

## Adding a future layout

1. Add `references/quotation-layout-<layout_id>.md` (flat path) with:
   - Display name + column definitions
   - Row JSON shape for `product_quotation.data.rows`
   - Mapping tips from SKU/package fields
   - Optional screenshot under skill-root `assets/`
2. Add a row to the Built-in layouts table above
3. Mention the layout_id + exact `resource_name` in agent `system_prompt.md` / `SKILL.md`

No backend code change is required for template-only layouts.

## Custom layout

When user rejects built-ins:

- Set `quotation_layout` / `layout_id` to `custom`
- Put column defs in `section_meta.ui_render_mapping.columns`
- Fill `rows` with keys matching those columns
- Keep `is_custom: true` on free-form priced lines
