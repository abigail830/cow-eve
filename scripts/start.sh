#!/usr/bin/env bash
# Start cow-eve frontend + backend (parse-pipeline, omni).
#
# Usage:
#   ./scripts/start.sh              # all services
#   ./scripts/start.sh all
#   ./scripts/start.sh backend      # parse-pipeline + omni
#   ./scripts/start.sh frontend
#   ./scripts/start.sh omni
#   ./scripts/start.sh parse-pipeline
#
# Set START_PARSE_PIPELINE=0 to skip parse-pipeline when starting backend/omni/all.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET="${1:-all}"

start_omni() {
  if [[ "${START_PARSE_PIPELINE:-1}" == "1" ]]; then
    start_parse_pipeline
  fi
  clear_omni_eve_workflow_runs
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
  parse-pipeline)
    start_parse_pipeline
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Use: all | backend | frontend | omni | parse-pipeline"
    exit 1
    ;;
esac

echo
echo "URLs:"
if [[ "${TARGET}" == "all" || "${TARGET}" == "frontend" ]]; then
  echo "  Frontend:       http://127.0.0.1:${FRONTEND_PORT}"
fi
if [[ "${TARGET}" != "frontend" && "${TARGET}" != "parse-pipeline" ]]; then
  echo "  Omni API:       http://127.0.0.1:${OMNI_PORT}"
fi
if [[ "${TARGET}" == "parse-pipeline" || ( "${TARGET}" != "frontend" && "${START_PARSE_PIPELINE:-1}" == "1" ) ]]; then
  echo "  Parse pipeline: http://${PARSE_PIPELINE_HOST}:${PARSE_PIPELINE_PORT}"
fi
echo
echo "Logs: ${LOG_DIR}"
echo "Stop: ./scripts/stop.sh ${TARGET}"
