---
name: proposal-blueprints
description: >-
  Proposal blueprint registry, section graphs, snippets, and playbooks for
  assembling client-facing narrative (SOS, exec summary, acceptance) after
  fee lines are set. Use when structuring SG SME or other blueprint-backed proposals.
---

# Proposal blueprints

**Capability:** **document architecture** and **narrative assembly** for a blueprint-backed proposal.

**Not in this skill:** catalog matching, recall, or row pricing — see **`proposal-catalog-explorer`**.

Registry JSON under `references/` is also bundled for **`proposal_list_blueprints`** / **`proposal_init_compose`** tools; use those tools for ids and defaults, not raw disk paths.

## When to load

- Choosing or confirming **which proposal scenario** (blueprint) applies.
- After quotation lines are stable enough to draft **SOS**, executive summary, or snippet blocks.
- Before export (Phase 2) when graph order drives output.

Pair with catalog skill: **catalog first (lines) → blueprints second (story)**.

**References:** after **`load_skill`**, read playbooks/snippets via **`read_file`** under `/workspace/skills/proposal-blueprints/…` (or `$HOME/.agents/skills/…`). Blueprint JSON for tools is bundled — use **`proposal_list_blueprints`**, not host disk.

## Engagement slice (narrative half)

```
proposal_init_compose (blueprint_id, tier)
        → [catalog skill] quotation rows
        → read graph + sosMode + snippets
        → executive_summary.md, scope_of_services.md, …
        → extension-backed first-invoice wording
        → export (when enabled)
```

## Invariants

1. **Blueprint = scene** — graph defines which sections exist (e.g. with/without About); switching blueprint switches **structure**, not catalog BU by itself.
2. **SOS ≠ raw SOW dump** — deliverables from catalog; grouping and transitions from playbooks (**`references/narrative-assembly.md`**).
3. **Quotation change invalidates SOS** — regenerate scope markdown when rows change.
4. **Snippets are firm voice; numbers are not** — fees and GST from `quotation.json` + extensions only.
5. **Playbooks are procedures** — follow steps in `references/playbooks/` rather than improvising section logic.

## Registry (pointers)

| Need | Location |
|------|----------|
| Supported blueprint ids | `references/blueprints/index.json` (prefer **`proposal_list_blueprints`**) |
| Blueprint config | `references/blueprints/acorp-sg-sme-abs.json`, `acorp-sg-sme-rikvin.json` |
| Section order | `references/graphs/sg-sme-abs.json`, `sg-sme-rikvin.json` |
| Components | `references/components/registry.json` |
| Client + tax schemas | `references/schemas/client-fields-global.json`, `tax-rates.json` |
| SOS assembly | `references/playbooks/sow-to-sos.md` |
| First invoice wording | `references/playbooks/first-invoice.md` |
| Narrative practice | **`references/narrative-assembly.md`** |
| Static copy blocks | `references/snippets/` |

## Tools

- **`proposal_list_blueprints`**, **`proposal_init_compose`**
- **`proposal_write_compose_file`** for markdown sections and meta
- **`proposal_compute_extension`** when graph enables first-invoice / GST block

Pricing / matching: **`proposal-catalog-explorer`**.
