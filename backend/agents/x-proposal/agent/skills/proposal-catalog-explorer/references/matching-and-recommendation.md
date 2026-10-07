# Matching & recommendation — dual recall, unified rerank

## Principle

**No type priority.** Solution packages (business cases) and individual services are **not** ranked by kind — only by **composite fit** to the customer's stated needs.

Always run **two-path recall**, enrich candidates with full catalog context (especially **SOW**), **rerank on one unified list**, then act by **confidence band**.

```
Customer need (+ region/BU)
        │
        ├─► Path A: package-catalog-explorer
        │         business_case / solution_packages
        │         → expand member services + adhoc pool
        │
        └─► Path B: product-catalog-explorer
                  individual service rows (+ VN service_catalog)
        │
        ▼
   Enrich each candidate
   (name, SOW, fees, category, package membership, combo logic)
        │
        ▼
   Unified rerank (composite score — no package-vs-SKU bias)
        │
        ▼
   Confidence band → auto-add | recommend + gaps | guided questions
```

## Solution package = business case

- DB: `business_case` on `service_and_fee_*`; VN also `solution_packages` on `service_catalog`
- Normalize labels: JSON array + **`;` split** within each string (see `package-catalog-explorer` → `references/catalog-terminology.md`)
- Package id = **exact normalized business case name**

---

## Phase 1 — Dual recall (single MCP call)

Call **`recall_catalog`** once with **`queries[]`** (short concepts from the customer need). PK runs **both** product and package paths, tokenizes concepts, scores (including `*_semantic_for_ai`), and returns **`products`**, **`packages`**, and unified **`candidates`**. Do **not** stop early because one path already has hits.

| Path | PK behavior | Agent next step |
|------|-------------|-----------------|
| **A — Packages** | Package rows with `package_semantic_for_ai` | Rerank; `expand_package` before commit |
| **B — Products** | Product rows with `sku_semantic_for_ai`, `scope_of_work` | Rerank; `get_product` for finalists |

**Recall breadth:** default limits ~20 per path; rerank down to top 3–5 for the user.

---

## Phase 2 — Enrich candidates (required for rerank)

For every candidate entering rerank, gather **full service information** from DB (do not match on name alone).

### Service row fields (prioritized)

| Field | Use in matching |
|-------|-----------------|
| `scope_of_work` | **Primary SOW** — semantic fit to customer scenario |
| `service_name_on_proposal` / `product_name` | Display + keyword signal |
| `price`, `recurring`, `billing_frequency`, `standard_pricing_matrix` | Fee type fit (one-off vs recurring); map to rows in **`compose-session.md`** |
| `sku_semantic_for_ai` | Table split / bundle hints at commit time |
| Package `package_semantic_for_ai` | Bundle-level fit and block structure |

VN `service_catalog`: also `scope_of_work`, `internal_product_description`, `agent_notes`.

### Package-level enrichment

For each package candidate, build a **virtual bundle profile**:

1. **Package name semantics** — parse `{Category} * {Sub-bundle}`; match lifecycle words (Acorp, Transfer in, Takeover, Annual compliance, …)
2. **Member service set** — ids/names from expanded query
3. **Combined SOW** — concatenate member `scope_of_work` + `service_items` (dedupe)
4. **Combo logic** — infer intent from predefined mix, e.g.:
   - Acorp + CS + registered office → new entity setup
   - CS only → existing entity compliance
   - Tax + payroll + accounting → compliance bundle
5. **Coverage map** — which user-stated needs are covered / partial / missing
6. **Over-coverage** — services in bundle user did **not** ask for (cost/scope delta)

### Custom service combination (no predefined package)

If top individual services together cover user needs but no single business case matches, surface as candidate type **`service_mix`** with suggested table title — same rerank pool, no penalty vs predefined package.

---

## Phase 3 — Unified rerank (composite score)

Score **all** candidate types on the same dimensions. Weights are guidance — use holistic judgment, but **do not** boost/penalize solely because the candidate is a package or a single service.

| Dimension | What to compare | Weight |
|-----------|-----------------|--------|
| **SOW / scope fit** | Customer scenario vs `scope_of_work`, `service_items`, deliverables | **Highest** |
| **Need coverage** | % of stated requirements covered; critical needs must not be missing | **High** |
| **Package name & combo logic** | Label + member set matches lifecycle / industry / entity type | **High** |
| **Region / BU / currency** | Hard filter when explicit; else soft signal | Hard / medium |
| **Fee structure fit** | One-off vs recurring vs matrix matches user expectation | Medium |
| **Precision vs over-coverage** | Penalize bundles with large unrelated scope unless user wants full suite | Medium |
| **Exact user reference** | Named business case or SKU | Treat as strong prior |

Internally estimate **`match_confidence`** 0–100%. In chat, show **business reasons only** — **never** show percentages or the word "confidence".

### Rerank output shape (internal)

For each top candidate, note briefly:

- `candidate_type`: `business_case` | `service` | `service_mix`
- `confidence`: 0–100
- `covers`: …
- `missing_vs_user`: …
- `extra_vs_user`: … (scope in catalog but not requested)

---

## Phase 4 — Confidence bands & actions

| Band | Range | Action |
|------|-------|--------|
| **High** | **≥ 80%** | **Auto-add** (or single clear winner); confirm in chat what was added and why |
| **Medium** | **50–79%** | **Recommend** top 2–4 options; show **differences vs customer need**; wait for choice before patch |
| **Low** | **< 50%** | **Do not auto-add**; explain best weak matches + **guided questions** to close gaps |

**50% rule:** if the best candidate is **below 50%**, or top two are within ~10% and both below 70%, treat as **uncertain** — always use diff + questions, never silent auto-add.

### Medium / low — user-facing diff template

Do **not** dump JSON. Example (medium band):

> **Best matches for *Singapore Acorp + company secretary (SME)*:**
>
> 1. **Private Limited CS full suite SME** — covers Acorp setup, named company secretary, registered office. *Does not include* nominee director (you mentioned possibly needing one).
> 2. **Acorp setup** + **Company Secretarial services** à la carte — more control; you assemble recurring vs one-off separately.
>
> **Gap vs your brief:** nominee director not in option 1 by default.
>
> Prefer (1) full package, (2) pick services, or should I include nominee director?

### Guided questions (when confidence < 50% or critical gap)

Ask **minimal** high-value clarifiers tied to catalog structure:

- Entity status: new Acorp vs transfer-in vs already Acorp-registered?
- Scope: full compliance bundle vs single service (e.g. CS only, tax only)?
- Optional modules mentioned in SOW but not in base package (nominee director, XBRL, payroll)?
- Region/BU ambiguity (SG vs MY, Acorp vs Harneys AU)?
- Budget / fee type preference (one-off vs annual retainer)?

Frame questions from **specific gaps** found in diff (`missing_vs_user`), not generic scripts.

---

## Phase 5 — Commit policy (after user choice or high confidence)

| Situation | Action |
|-----------|--------|
| High-confidence single **business case** | Expand to member services; one row per predefined service; adhoc as optional |
| High-confidence single **service** | Add that row; mention parent package(s) if confidence for package ≥ 50% |
| High-confidence **service_mix** | Add selected rows; suggest auto-generated table title |
| User picks from medium-band list | Add chosen option only |
| User refines after guided questions | Re-run recall + rerank with new facts |
| No catalog hit ≥ 50% | Offer **custom** rows (`isCustom: true`) or escalate to manual scope |

**Persist shape:** map catalog fields → quotation rows per **`compose-session.md`** (compact vs layout serialization). Write via **`proposal_write_compose_file`**.

## Auto-add checklist (high-confidence business case)

1. Layout family: user request → catalog hint → default `simplified_billing_frequency` (see layout registry)
2. Quotation section title = package display name where applicable
3. Expand package → one row per committed member service; fees from catalog fields (`price`, `recurring`, `billing_frequency`, matrix when present)
4. Adhoc pool: mention only unless user opts in
5. Linkage on rows: `source_type` / `source_id` or compact `sku` + `source: catalog` per **`compose-session.md`**
6. User-facing: what was added, business rationale (not match scores); then hand off to **`proposal-blueprints`** if SOS or exec summary is in scope

---

## Multi-package services

When one service row maps to packages `A; B` or `[A, B]`:

- Rerank **each package separately** using full bundle profile
- Include the **service alone** as its own candidate in the same pool
- On commit to package A, include the service once; note membership in B if relevant

---

## Recall round checklist

- [ ] **`recall_catalog`** executed (both paths in one call)
- [ ] Fetched **`scope_of_work`** for rerank finalists (not name-only)
- [ ] Built package bundle profiles (member set + combined SOW + combo logic)
- [ ] Unified rerank — no default preference for package or service type
- [ ] Assigned confidence band; applied **50% / 80%** thresholds
- [ ] Medium/low: showed **diff** (`covers` / `missing` / `extra`) or **guided questions**
- [ ] Rows persisted per **`compose-session.md`**; `*_semantic_for_ai` retained where relevant
- [ ] Layout family chosen; quotation `layout` id set from registry
- [ ] If narrative sections are in scope: **`proposal-blueprints`** loaded for SOS / graph next
