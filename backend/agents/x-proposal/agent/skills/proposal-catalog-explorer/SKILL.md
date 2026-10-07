---
name: proposal-catalog-explorer
description: >-
  Matches customer needs to verified catalog (dual-path recall, unified rerank)
  and persists fee lines into the compose session. Use when selecting SKUs,
  packages, layouts, or quotation rows for X Proposal.
---

# Proposal catalog explorer

**Capability:** turn the customer brief + blueprint `business_unit` into **verified lines** in the compose session.

**Not in this skill:** section order, SOS prose, About/acceptance snippets — see **`proposal-blueprints`**.

## When to load

- After **`proposal_init_compose`** (you need `meta.json` / business unit).
- Whenever the rep changes scope, entity type, or package choice.
- Before the first **`recall_catalog`** call in a turn.

Always **`load_skill`** this skill first (procedure enters the turn). Optional depth lives in packaged **`references/`** — open with **`read_file`** on the skill paths Eve mounts in the sandbox (`/workspace/skills/<skill-name>/…` or `$HOME/.agents/skills/<skill-name>/…`). Do not search the host repo or run discovery loops when references are missing; retry after the sandbox session has started.

## Engagement slice (catalog half)

```
Customer brief + meta.businessUnit
        → recall (dual-path) + enrich SOW
        → unified rerank (no package-vs-SKU bias)
        → rep choice / confidence band
        → persist quotation rows (compose session)
        → [handoff] blueprint skill for SOS / sections
        → derived GST / first invoice when blueprint requires
```

## Invariants

1. **Catalog-first** — list prices and deliverables come from MCP; KB only suggests candidates, then catalog confirms or marks unverified custom lines.
2. **One recall pass per iteration** — one dual-path recall with `queries[]` (short concepts); drill down with `get_product` / `expand_package` only for finalists.
3. **Session is the quote** — selected lines live in `quotation.json`; chat tables are a view, not a second source of truth.
4. **Two row serializations** — compact vs layout-shaped rows; pick via layout family (default SG SME → layout rows). Full model: **`references/compose-session.md`**.
5. **Semantic fields stay attached** — preserve `sku_semantic_for_ai` / `package_semantic_for_ai` through commit for splits and table blocks.

## Cost discipline

- Prefer **one strong recall** + targeted drill-down over many vague recalls.
- Rerank on enriched SOW, not product name alone.
- Stop when the rep has a defensible short list or clear gaps for **`ask_question`**.

## Read order (references)

| Step | File |
|------|------|
| Terminology | `references/catalog-terminology.md` |
| Recall + rerank | `references/matching-and-recommendation.md` |
| MCP surface | `references/catalog-mcp-products.md`, `references/catalog-mcp-packages.md` |
| Layout choice | `references/quotation-layout-registry.md` → family spec |
| Persist rows | **`references/compose-session.md`** |
| Compact example | `references/compose-ir-quotation.md` |

## Catalog MCP (connection surface)

Use **`connection_search`** on **`proposal-catalog`** to see the **live** tool set for this deployment. Prefer **one dual-path recall** tool when listed (e.g. `recall_catalog`); use product/package drill-down tools for finalists. Tool names differ by server version — follow the connection, not stale docs.

## Tools (this half of the house)

- MCP: recall (dual-path) + **`get_product`** / **`get_package`** / **`expand_package`** as needed.
- Compose: **`proposal_write_compose_file`** for `quotation.json` (and related session files when matching updates client facts).
- Totals: **`proposal_compute_extension`** after priced rows exist — see blueprint playbook for first invoice.

User-visible copy: service titles, scope bullets, fees — never lead with SKU codes (see root **`instructions.md`** sales voice).
