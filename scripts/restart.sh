#!/usr/bin/env bash
# Restart cow-eve services (applies Postgres migrations before backend/omni start).
#
# Usage:
#   ./scripts/restart.sh
#   ./scripts/restart.sh all|backend|frontend|omni|parse-pipeline

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET="${1:-all}"

"${SCRIPT_DIR}/stop.sh" "${TARGET}"
sleep 0.5

case "${TARGET}" in
  all|backend|omni)
    ensure_env_files
    echo "Database migrations (before start)…"
    run_db_migrate
    export COW_EVE_SKIP_DB_MIGRATE=1
    ;;
esac

"${SCRIPT_DIR}/start.sh" "${TARGET}"
