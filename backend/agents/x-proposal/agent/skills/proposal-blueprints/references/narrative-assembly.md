# Narrative assembly — blueprint graph and client-facing scope

Proposal **narrative** (executive summary, Scope of Services, About, acceptance) is separate from **pricing truth** (catalog + `quotation.json`). This reference is the practice layer for turning a frozen fee table into readable engagement copy.

## Two different “scope” concepts

| Concept | Source | Used for |
|---------|--------|----------|
| **SKU Scope of Work** | Catalog (`scope_of_work`, deliverables) | Factual deliverables; must not be diluted |
| **Proposal SOS** | Assembled chapter for the client | Grouping, transitions, package story, section order |

SOS **includes** deliverables from the catalog; it is **not** a paste of every SKU SOW block in database order.

## What the blueprint controls

From blueprint JSON (via init compose → `meta.json`):

| Blueprint field | Narrative effect |
|-----------------|------------------|
| **Section graph** | Which blocks exist and in what order (e.g. About → letter → SOS → fees → first invoice → acceptance) |
| **`sosMode`** | How SOS relates to fees (`sos_separate_then_fees`, merged sections, interleaved band layout, …) |
| **Snippets** | Reusable firm copy (About, acceptance, fee intro) — **marketing shell**, not pricing |
| **Playbooks** | Algorithms for SOS assembly and first-invoice **wording** (amounts still from extensions) |

Changing blueprint changes **document architecture**, not catalog prices.

## Assembly workflow (after catalog commit)

1. **Stabilize lines** — `quotation.json` reflects the rep-approved selection (catalog skill / compose-session).
2. **Load graph** — read blueprint graph for this `blueprint_id`; list enabled components (SOS block, fee table, first invoice block, …).
3. **Executive summary** — short outcome-focused paragraph; package name and jurisdiction from client + meta; no SKU list.
4. **SOS** — follow `playbooks/sow-to-sos.md`:
   - Pull SOW from catalog for each **catalog-backed row** (`get_product` where needed).
   - Group by department, package, or service band per `sosMode`.
   - Dedupe identical bullets; preserve mandatory deliverables.
   - Write `scope_of_services.md` (or graph-specified path).
5. **Snippets** — merge `references/snippets/*` where the graph includes About / acceptance / fee intro; replace placeholders (`{{jurisdiction}}`, package display name).
6. **Fee presentation** — chat table mirrors quotation rows (service titles, billing); GST / first invoice phrasing follows playbook + extension output.

If the rep changes SKUs or fees, **repeat from step 1** before refreshing SOS or quoting new totals.

## Section graph vs quotation layout

| Mechanism | Governs |
|-----------|---------|
| **Quotation layout family** | Columns and row JSON shape in the fee table (catalog-explorer references) |
| **Section graph** | Proposal **document** sections and optional components (About, SOS placement, merged vs split fees) |

Example: two SG SME blueprints may share the same catalog BU and layout but differ on **whether About appears** — that is graph/snippet config, not a catalog change.

## Quality principles

- **Deliverable fidelity:** If SOW says a limit (e.g. name searches, director count), SOS must retain it.
- **One voice:** Snippets set tone; SOS body stays professional and specific to this deal.
- **No pricing in SOS alone:** When `sosMode` merges scope and fees, still source numbers from `quotation.json` / extensions, not from memory.
- **Stale detection:** Any edit to quotation rows invalidates SOS until regenerated.

## Handoff from catalog skill

| Catalog skill delivers | Blueprint skill delivers |
|------------------------|---------------------------|
| Matched services/packages, persisted rows | Graph order, SOS structure, snippets |
| `*_semantic_for_ai` for table splits | `sosMode` and playbooks for those splits in **narrative** |
| Client-facing fee table in chat | Executive summary, SOS markdown, acceptance blocks |

Load **proposal-catalog-explorer** for match + persist; load **proposal-blueprints** before drafting or rewriting narrative sections.
