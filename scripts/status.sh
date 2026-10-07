#!/usr/bin/env bash
# Show status of cow-eve services.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

ensure_run_dirs

echo "cow-eve status:"
service_status_line "parse-pipeline" "${PARSE_PIPELINE_PORT}"
service_status_line "proposal-knowledge" "${PROPOSAL_KNOWLEDGE_PORT}"
service_status_line "omni" "${OMNI_PORT}"
service_status_line "research" "${RESEARCH_PORT}"
service_status_line "nova-auditor" "${NOVA_AUDITOR_PORT}"
service_status_line "x-proposal" "${X_PROPOSAL_PORT}"
service_status_line "frontend" "${FRONTEND_PORT}"
echo
echo "Logs: ${LOG_DIR}"
