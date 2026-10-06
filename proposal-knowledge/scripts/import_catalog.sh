#!/usr/bin/env bash
# Import a product + package export pair (same MDM schema, any BU in the BU* column).
#
# Usage:
#   ./scripts/import_catalog.sh /path/to/products.xlsx /path/to/packages.csv
#
# Requires proposal-knowledge/.venv (see backend/scripts/setup_proposal_knowledge.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${ROOT}/.venv/bin/proposal-knowledge"

if [[ ! -x "${CLI}" ]]; then
  echo "Missing venv: ${CLI}" >&2
  echo "Run: ${ROOT}/../backend/scripts/setup_proposal_knowledge.sh" >&2
  exit 1
fi

PRODUCTS="${1:?products file (.xlsx or .csv)}"
PACKAGES="${2:?packages file (.xlsx or .csv)}"

cd "${ROOT}"
set -a
[[ -f .env ]] && source .env
set +a

"${CLI}" db init
"${CLI}" import catalog --products "${PRODUCTS}" --packages "${PACKAGES}"
