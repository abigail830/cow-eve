#!/usr/bin/env bash
# Stop cow-eve services started by scripts/start.sh.
#
# Usage:
#   ./scripts/stop.sh
#   ./scripts/stop.sh all
#   ./scripts/stop.sh backend|frontend|omni|parse-pipeline

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET="${1:-all}"

stop_backend() {
  stop_service "omni" "${OMNI_PORT}"
  stop_parse_pipeline
}

echo "Stopping cow-eve (${TARGET})…"
ensure_run_dirs

case "${TARGET}" in
  all)
    stop_service "frontend" "${FRONTEND_PORT}"
    stop_backend
    ;;
  backend)
    stop_backend
    ;;
  frontend)
    stop_service "frontend" "${FRONTEND_PORT}"
    ;;
  omni)
    stop_service "omni" "${OMNI_PORT}"
    ;;
  parse-pipeline)
    stop_parse_pipeline
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Use: all | backend | frontend | omni | parse-pipeline"
    exit 1
    ;;
esac

echo "Done."
