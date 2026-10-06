#!/usr/bin/env bash
# Prepare local proposal-knowledge HTTP service (venv + deps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PK_DIR="$ROOT/proposal-knowledge"

echo "==> proposal-knowledge venv + deps ($PK_DIR)"
cd "$PK_DIR"
if command -v uv >/dev/null 2>&1; then
  if [[ ! -d .venv ]]; then
    uv venv .venv --python 3.11
  fi
  uv pip install -e ".[dev]"
else
  if [[ ! -d .venv ]]; then
    python3.11 -m venv .venv 2>/dev/null || python3 -m venv .venv
  fi
  .venv/bin/pip install -U pip
  .venv/bin/pip install -e ".[dev]"
fi

echo "==> verify proposal-knowledge CLI"
.venv/bin/proposal-knowledge db init

if [[ ! -f "$PK_DIR/.env" ]]; then
  cp "$PK_DIR/.env.example" "$PK_DIR/.env"
  echo "Created proposal-knowledge/.env — set DATABASE_URL and PROPOSAL_KNOWLEDGE_ADMIN_KEY."
fi

cat <<EOF

Done. Start with repo scripts (./scripts/start.sh) or manually:
  cd proposal-knowledge && .venv/bin/proposal-knowledge serve --port 8093

Import catalog pair:
  proposal-knowledge/scripts/import_catalog.sh /path/to/products.xlsx /path/to/packages.xlsx

EOF
