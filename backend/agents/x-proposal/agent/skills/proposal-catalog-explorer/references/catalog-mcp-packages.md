# Package catalog — proposal-catalog MCP (PK)

Packages are normalized solution packages in PK.

## Recall

Packages arrive on the same **`recall_catalog`** call as products (dual-path).

1. Same `business_unit` as compose meta.
2. Pass **`queries[]`** from the brief.
3. Use **`package_semantic_for_ai`** for bundle / table-block guidance through persist (`compose-session.md`).
4. Before high-confidence commit: **`get_package`** + **`expand_package`** for member SKUs and combined SOW.

## Terminology

See `catalog-terminology.md` for package vs product naming.

## Rules

- Package id for state = PK `package_id` from recall / get.
- Expand before high-confidence commit; include member **scope_of_work** in rerank.
