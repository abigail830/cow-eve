#!/usr/bin/env bash
# Restart cow-eve services.
#
# Usage:
#   ./scripts/restart.sh
#   ./scripts/restart.sh all|backend|frontend|omni

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-all}"

"${SCRIPT_DIR}/stop.sh" "${TARGET}"
sleep 0.5
"${SCRIPT_DIR}/start.sh" "${TARGET}"
