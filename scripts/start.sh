#!/usr/bin/env bash
# Start cow-eve frontend + backend (omni).
#
# Usage:
#   ./scripts/start.sh              # all services
#   ./scripts/start.sh all
#   ./scripts/start.sh backend      # omni
#   ./scripts/start.sh frontend
#   ./scripts/start.sh omni

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET="${1:-all}"

start_omni() {
  start_service \
    "omni" \
    "${ROOT_DIR}/backend" \
    "npm run dev:omni" \
    "${OMNI_PORT}" \
    "http://127.0.0.1:${OMNI_PORT}/eve/v1/health"
}

start_frontend() {
  start_service \
    "frontend" \
    "${ROOT_DIR}/frontend" \
    "npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}" \
    "${FRONTEND_PORT}" \
    "http://127.0.0.1:${FRONTEND_PORT}/"
}

echo "Starting cow-eve (${TARGET})…"
ensure_run_dirs
ensure_env_files

case "${TARGET}" in
  all|backend|omni)
    run_db_migrate
    ;;
esac

case "${TARGET}" in
  all)
    start_omni
    start_frontend
    ;;
  backend)
    start_omni
    ;;
  frontend)
    start_frontend
    ;;
  omni)
    start_omni
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Use: all | backend | frontend | omni"
    exit 1
    ;;
esac

echo
echo "URLs:"
echo "  Frontend:  http://127.0.0.1:${FRONTEND_PORT}"
echo "  Omni API:  http://127.0.0.1:${OMNI_PORT}"
echo
echo "Logs: ${LOG_DIR}"
echo "Stop: ./scripts/stop.sh"
