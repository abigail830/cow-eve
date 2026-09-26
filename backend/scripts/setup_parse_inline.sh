#!/usr/bin/env bash
# Prepare local parse-pipeline HTTP service (venv + deps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PARSE_DIR="$ROOT/parse-pipeline"

echo "==> parse-pipeline venv + deps ($PARSE_DIR)"
cd "$PARSE_DIR"
if command -v uv >/dev/null 2>&1; then
  if [[ ! -d .venv ]]; then
    uv venv .venv --python 3.11
  fi
  uv pip install -e ".[dev]"
else
  if [[ ! -d .venv ]]; then
    python3.11 -m venv .venv 2>/dev/null || python3 -m venv .venv
  fi
  .venv/bin/pip install -U pip
  .venv/bin/pip install -e ".[dev]"
fi

echo "==> verify parse-pipeline CLI"
.venv/bin/parse-pipeline run-job --help >/dev/null

if [[ ! -f "$PARSE_DIR/.env" ]]; then
  cp "$PARSE_DIR/.env.example" "$PARSE_DIR/.env"
  echo "Created parse-pipeline/.env — set DOCUMENT_MIND_* and PARSE_PIPELINE_API_KEYS."
fi

SERVICE_KEY=""
if [[ -f "$PARSE_DIR/.env" ]]; then
  line=$(grep -E '^PARSE_PIPELINE_API_KEYS=' "$PARSE_DIR/.env" | head -1 || true)
  if [[ -n "$line" ]]; then
    pair=$(echo "$line" | cut -d= -f2- | cut -d, -f1)
    SERVICE_KEY=$(echo "$pair" | cut -d: -f2-)
  fi
fi

cat <<EOF

Parse service environment ready.

  ./scripts/restart.sh

Backend .env (service mode, Omni on :2000):

  PARSE_PIPELINE_DISPATCH=service
  PARSE_PIPELINE_SERVICE_URL=http://127.0.0.1:8091
  PARSE_PIPELINE_PUBLIC_BASE_URL=http://127.0.0.1:2000
  PARSE_PIPELINE_SERVICE_API_KEY=${SERVICE_KEY:-<from parse-pipeline/.env>}
  PARSE_PIPELINE_SERVICE_CALLER_ID=cow-eve

EOF
