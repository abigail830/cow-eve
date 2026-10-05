#!/usr/bin/env bash
# Start cow-eve frontend + backend (parse-pipeline, omni, research).
#
# Usage:
#   ./scripts/start.sh              # all services
#   ./scripts/start.sh all
#   ./scripts/start.sh backend      # parse-pipeline + omni
#   ./scripts/start.sh frontend
#   ./scripts/start.sh omni
#   ./scripts/start.sh research
#   ./scripts/start.sh nova-auditor
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
    "set -a && [ -f .env ] && . ./.env; set +a; npm run dev:omni" \
    "${OMNI_PORT}" \
    "http://127.0.0.1:${OMNI_PORT}/eve/v1/health"
}

start_research() {
  clear_research_eve_workflow_runs
  start_service \
    "research" \
    "${ROOT_DIR}/backend" \
    "set -a && [ -f .env ] && . ./.env; set +a; npm run patch:research-workflow-id; npm run dev:research" \
    "${RESEARCH_PORT}" \
    "http://127.0.0.1:${RESEARCH_PORT}/eve/v1/health"
  node "${ROOT_DIR}/backend/scripts/patch-eve-research-workflow-id.mjs" || true
}

start_nova_auditor() {
  start_service \
    "nova-auditor" \
    "${ROOT_DIR}/backend" \
    "set -a && [ -f .env ] && . ./.env; set +a; npm run dev:nova-auditor" \
    "${NOVA_AUDITOR_PORT}" \
    "http://127.0.0.1:${NOVA_AUDITOR_PORT}/eve/v1/health"
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
    if [[ "${COW_EVE_SKIP_DB_MIGRATE:-}" != "1" ]]; then
      run_db_migrate
    fi
    ;;
esac

case "${TARGET}" in
  all)
    start_omni
    start_research
    start_nova_auditor
    start_frontend
    ;;
  backend)
    start_omni
    start_research
    start_nova_auditor
    ;;
  frontend)
    start_frontend
    ;;
  omni)
    start_omni
    ;;
  research)
    start_research
    ;;
  nova-auditor)
    start_nova_auditor
    ;;
  parse-pipeline)
    start_parse_pipeline
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Use: all | backend | frontend | omni | research | nova-auditor | parse-pipeline"
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
if [[ "${TARGET}" == "all" || "${TARGET}" == "backend" || "${TARGET}" == "research" ]]; then
  echo "  Research API:   http://127.0.0.1:${RESEARCH_PORT}"
fi
if [[ "${TARGET}" == "all" || "${TARGET}" == "backend" || "${TARGET}" == "nova-auditor" ]]; then
  echo "  Nova Auditor:   http://127.0.0.1:${NOVA_AUDITOR_PORT}"
fi
if [[ "${TARGET}" == "parse-pipeline" || ( "${TARGET}" != "frontend" && "${START_PARSE_PIPELINE:-1}" == "1" ) ]]; then
  echo "  Parse pipeline: http://${PARSE_PIPELINE_HOST}:${PARSE_PIPELINE_PORT}"
fi
echo
echo "Logs: ${LOG_DIR}"
echo "Stop: ./scripts/stop.sh ${TARGET}"
