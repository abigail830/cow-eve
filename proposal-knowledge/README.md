# proposal-knowledge

Standalone proposal catalog (MDM) and team directory (CV) service. Exposes **Streamable HTTP MCP** endpoints for Eve agents. No imports from `backend/platform` — coupling is **Bearer API key + MCP URL only**.

## Requirements

- Python 3.11+

## Local setup

First-time venv (from repo root):

```bash
./backend/scripts/setup_proposal_knowledge.sh
```

Or manually:

```bash
cd proposal-knowledge
python3.11 -m venv .venv
source .venv/bin/activate
pip install ".[dev]"
cp .env.example .env
proposal-knowledge db init
proposal-knowledge serve --port 8093
```

With cow-eve scripts:

```bash
./scripts/start.sh proposal-knowledge   # or ./scripts/restart.sh all
```

Health: `GET http://127.0.0.1:8093/health`

MCP URLs (include `/mcp` suffix):

- Catalog: `http://127.0.0.1:8093/api/mcp/catalog/mcp`
- CV: `http://127.0.0.1:8093/api/mcp/cv/mcp`

Schema: `proposal-knowledge db init` runs SQLAlchemy `create_all` (idempotent). `./scripts/restart.sh` runs this before starting the service when `proposal-knowledge/.env` has `DATABASE_URL`.

## Blob avatars

Set **`BLOB_STORE_ID`** (e.g. `store_…` from Vercel) and **`BLOB_ACCESS`** (`public` or `private`). If **`AVATAR_PUBLIC_BASE_URL`** is empty, the service derives:

`https://{store_id}.{public|private}.blob.vercel-storage.com`

Relative paths in `avatar_blob_path` are appended to that base for `get_person` / `search_people`.

- **Public** blobs: `avatar_url` works for anyone with the link.
- **Private** blobs: URLs still follow the private hostname; anonymous fetch may fail unless you store a full HTTPS URL in `avatar_blob_path` or upload CV images as public objects under a dedicated prefix.

`BLOB_READ_WRITE_TOKEN` is reserved for future upload tooling; imports only store paths.

## API keys

Create keys in the **PK database** (shown once):

```bash
export PROPOSAL_KNOWLEDGE_ADMIN_KEY=your-admin-secret
proposal-knowledge keys create --label team-alpha --all-bus
# Restrict to one or more BU* values from your exports:
proposal-knowledge keys create --label team-beta --bus EXAMPLE-BU-01,EXAMPLE-BU-02
```

Eve users paste `pk_live_…` into Integrations (`proposal_knowledge`); env bootstrap keys are optional for local dev only.

## Import catalog (product + package exports)

Use the **same column headers** as your MDM product schema export and solution package export (`.xlsx` or `.csv`). Rows are keyed by **`BU*`** + SKU / package ID — you can load many business units into one database; each new file **upserts** rows for the BUs present in that file.

### One command (recommended)

```bash
cd proposal-knowledge
./scripts/import_catalog.sh /path/to/product_export.xlsx /path/to/package_export.xlsx
```

### CLI equivalents

```bash
proposal-knowledge db init
proposal-knowledge import catalog \
  --products /path/to/product_export.csv \
  --packages /path/to/package_export.xlsx

# Or separately:
proposal-knowledge import products --file /path/to/product_export.xlsx
proposal-knowledge import packages --file /path/to/package_export.csv
```

Required columns (must match export headers exactly):

**Products:** `SKU*`, `BU*`, `Product name*`, `Product description`, `Service name on Proposal`, `Scope of Work`, `SKU Semantic for AI`, `Billing frequency*`, `Currency*`, `Price`, `Recurring`, `Standard pricing matrix`, `Department/Team`, `Status*`, `Jurisdictions`

**Packages:** `ID*`, `BU*`, `Package name*`, `Package description`, `Package Semantic for AI`, `Linked SKU`

After import, issue or update API keys so `allowed_business_units` includes the new `BU*` values.

## Import CV (team directory)

CV is **not** in the catalog xlsx; use a JSON **array** of objects.

Example shape: [`docs/people.example.json`](docs/people.example.json)

| Field | Required | Notes |
|-------|----------|--------|
| `business_unit` | yes | Same semantics as catalog `BU*` |
| `display_name` | yes | |
| `department` | yes | |
| `title` | yes | |
| `region` | yes | Label for proposals (not a catalog column) |
| `bio` | no | Defaults to empty string |
| `phone` | no | |
| `id` | no | UUID; generated if omitted |
| `avatar_blob_path` | no | Relative blob key or full `https://…` URL |

```bash
proposal-knowledge import people --json ./my-team.json
# or
./scripts/import_people.sh ./my-team.json
```

Re-importing with the same `id` updates the row.

## Vercel

Separate Vercel project, root directory `proposal-knowledge`. Env: `DATABASE_URL`, `PROPOSAL_KNOWLEDGE_ADMIN_KEY`, `API_KEY_HASH_PEPPER`, blob vars as needed.

## Tests

```bash
PYTHONPATH=. pytest -q
```
