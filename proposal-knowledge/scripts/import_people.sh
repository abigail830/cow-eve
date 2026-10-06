#!/usr/bin/env bash
# Import team directory (CV) from a JSON array.
#
# Usage:
#   ./scripts/import_people.sh /path/to/people.json

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${ROOT}/.venv/bin/proposal-knowledge"

if [[ ! -x "${CLI}" ]]; then
  echo "Missing venv: ${CLI}" >&2
  exit 1
fi

JSON="${1:?people.json path}"

cd "${ROOT}"
set -a
[[ -f .env ]] && source .env
set +a

"${CLI}" db init
"${CLI}" import people --json "${JSON}"
