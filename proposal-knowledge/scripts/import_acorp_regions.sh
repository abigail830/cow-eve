#!/usr/bin/env bash
# Import multi-region catalog exports with INCORP → Acorp sanitization.
# Usage: ./scripts/import_acorp_regions.sh [repo-root]

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
DOCS="${REPO_ROOT}/docs"
PK="${REPO_ROOT}/proposal-knowledge"
CLI="${PK}/.venv/bin/proposal-knowledge"

if [[ ! -x "${CLI}" ]]; then
  echo "Run backend/scripts/setup_proposal_knowledge.sh first." >&2
  exit 1
fi

cd "${PK}"

pairs=(
  "INCORP-AU_product_schema_export_20261007T005008Z.xlsx|INCORP-AU_solution_package_export_20261007T005003Z.xlsx"
  "INCORP-HK_product_schema_export_20261006T121554Z.xlsx|INCORP-HK_solution_package_export_20261006T121602Z.xlsx"
  "INCORP-MY_product_schema_export_20261007T004936Z.xlsx|INCORP-MY_solution_package_export_20261007T004943Z.xlsx"
  "INCORP-SG_product_schema_export_20261007T005025Z.xlsx|INCORP-SG_solution_package_export_20261007T005029Z.xlsx"
)

"${CLI}" db init
"${CLI}" import purge-bu-prefix --prefix INCORP-

total_p=0
total_k=0
for entry in "${pairs[@]}"; do
  IFS='|' read -r prod pkg <<<"${entry}"
  prod_path="${DOCS}/${prod}"
  pkg_path="${DOCS}/${pkg}"
  if [[ ! -f "${prod_path}" || ! -f "${pkg_path}" ]]; then
    echo "Skip missing: ${prod} / ${pkg}" >&2
    continue
  fi
  echo "==> ${prod} + ${pkg}"
  out=$("${CLI}" import catalog --sanitize-acorp --products "${prod_path}" --packages "${pkg_path}")
  echo "${out}"
  total_p=$((total_p + $(echo "${out}" | sed -n 's/Imported \([0-9]*\) products.*/\1/p')))
  total_k=$((total_k + $(echo "${out}" | sed -n 's/Imported [0-9]* products, \([0-9]*\) packages/\1/p')))
done

echo "Done. Total products=${total_p}, packages=${total_k} (Acorp-* BUs)."
