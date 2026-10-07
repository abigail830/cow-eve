# SOW → SOS assembly

Procedure for **`sos_separate_then_fees`** and related modes. Principles and graph context: **`../narrative-assembly.md`**.

## Inputs

- Stable **`quotation.json`** rows (catalog-backed or approved custom).
- Blueprint **`sosMode`** and section graph (which SOS block to fill).
- Catalog **`scope_of_work`** per committed SKU (`get_product` when row metadata is thin).

## Steps

1. List rows that contribute to scope (typically `source: catalog` or verified custom).
2. For each SKU, ensure deliverables are loaded from catalog SOW — **no paraphrase that drops limits or exclusions**.
3. Group bullets by package, department, or service band per **`sosMode`** (not by raw DB row order).
4. Dedupe identical deliverables; keep conflicting lines explicit if two SKUs overlap.
5. Add short transitions (why this bundle fits the engagement) — **playbook tone**, not new deliverables.
6. Write **`scope_of_services.md`** (or path specified in graph).
7. If quotation rows change later, repeat from step 1 before export or client send.

## Outputs

- Client-ready SOS markdown aligned with blueprint graph placement (usually before or with fees per `sosMode`).
- Chat summary may excerpt SOS; full text lives in session markdown.

Pricing tables and GST totals remain driven by quotation + extensions, not embedded invented amounts in SOS.
