#!/usr/bin/env bash
# Stop cow-eve services started by scripts/start.sh.
#
# Usage:
#   ./scripts/stop.sh
#   ./scripts/stop.sh all
#   ./scripts/stop.sh backend|frontend|omni|content-studio

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET="${1:-all}"

echo "Stopping cow-eve (${TARGET})…"
ensure_run_dirs

case "${TARGET}" in
  all)
    stop_service "frontend" "${FRONTEND_PORT}"
    stop_service "content-studio" "${CONTENT_STUDIO_PORT}"
    stop_service "omni" "${OMNI_PORT}"
    ;;
  backend)
    stop_service "content-studio" "${CONTENT_STUDIO_PORT}"
    stop_service "omni" "${OMNI_PORT}"
    ;;
  frontend)
    stop_service "frontend" "${FRONTEND_PORT}"
    ;;
  omni)
    stop_service "omni" "${OMNI_PORT}"
    ;;
  content-studio)
    stop_service "content-studio" "${CONTENT_STUDIO_PORT}"
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Use: all | backend | frontend | omni | content-studio"
    exit 1
    ;;
esac

echo "Done."
