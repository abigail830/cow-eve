#!/usr/bin/env bash
# Keep content-studio (eve dev) running; restart automatically on exit.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

cd "${ROOT_DIR}/backend"
PORT="${CONTENT_STUDIO_PORT:-2001}"
LOG="$(log_file content-studio)"

while true; do
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] content-studio starting (port ${PORT})" >>"${LOG}"
  npx eve dev --agent content-studio --no-ui --port "${PORT}" >>"${LOG}" 2>&1 || true
  code=$?
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] content-studio exited (code ${code}), restarting in 2s" >>"${LOG}"
  sleep 2
done
