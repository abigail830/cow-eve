# Product catalog — proposal-catalog MCP (PK)

`business_unit` from Compose `meta.json` (blueprint catalog).

## Recall

Dual-path recall is **`recall_catalog`** (products + packages in one call).

1. From the customer brief, extract **3–8 short concepts** (1–3 words each): e.g. `incorporation`, `bookkeeping`, `corporate secretarial`.
2. Call with compose **`business_unit`**, `queries[]`, optional `jurisdiction`.
3. Keep **`sku_semantic_for_ai`** on product hits through commit — it guides row splits and table blocks (`compose-session.md`).
4. Rerank per `matching-and-recommendation.md`; drill down with **`get_product`** for finalists.

## Rules

- Never invent SKU or price.
- Custom lines: `is_custom: true`, `price_status: unverified` until user confirms.
- Do **not** use the built-in `agent` tool for catalog calls.
