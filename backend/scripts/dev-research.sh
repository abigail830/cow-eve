#!/usr/bin/env bash
# Research dev + periodic workflow-id patch (Eve #3740 hot-reload reintroduces mismatch).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT="${RESEARCH_PORT:-2002}"

patch_loop() {
  while true; do
    node "${SCRIPT_DIR}/patch-eve-research-workflow-id.mjs" >/dev/null 2>&1 || true
    sleep 2
  done
}

patch_loop &
PATCH_PID=$!

cleanup() {
  kill "${PATCH_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "${BACKEND_ROOT}/agents/research"
export EVE_INTERNAL_AGENT_WORKSPACE_MEMBER=1
exec "${BACKEND_ROOT}/node_modules/.bin/eve" dev --no-ui --port "${PORT}"
