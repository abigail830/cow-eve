#!/usr/bin/env bash
# Shared helpers for cow-eve start/stop/restart.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
LOG_DIR="${RUN_DIR}/logs"

OMNI_PORT="${OMNI_PORT:-2000}"
CONTENT_STUDIO_PORT="${CONTENT_STUDIO_PORT:-2001}"
FRONTEND_PORT="${FRONTEND_PORT:-5273}"

ensure_run_dirs() {
  mkdir -p "${LOG_DIR}"
}

pid_file() {
  echo "${RUN_DIR}/$1.pid"
}

log_file() {
  echo "${LOG_DIR}/$1.log"
}

is_pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

read_pid() {
  local file
  file="$(pid_file "$1")"
  if [[ -f "${file}" ]]; then
    tr -d '[:space:]' <"${file}"
  fi
}

# Kill process tree rooted at pid (best-effort on macOS/Linux).
kill_tree() {
  local pid="$1"
  local child
  if ! is_pid_running "${pid}"; then
    return 0
  fi
  while read -r child; do
    [[ -n "${child}" ]] && kill_tree "${child}"
  done < <(pgrep -P "${pid}" 2>/dev/null || true)
  kill "${pid}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! is_pid_running "${pid}"; then
      return 0
    fi
    sleep 0.2
  done
  kill -9 "${pid}" 2>/dev/null || true
}

# Free a TCP port if something is listening (orphan from prior runs).
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  echo "  freeing port ${port} (pids: ${pids})"
  # shellcheck disable=SC2086
  kill ${pids} 2>/dev/null || true
  sleep 0.4
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

wait_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-40}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --max-time 1 "${url}" >/dev/null 2>&1; then
      echo "  ✓ ${name} ready (${url})"
      return 0
    fi
    sleep 0.25
  done
  echo "  ✗ ${name} did not become ready at ${url} (see $(log_file "${name}"))"
  return 1
}

ensure_env_files() {
  if [[ ! -f "${ROOT_DIR}/backend/.env" && -f "${ROOT_DIR}/backend/.env.example" ]]; then
    cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
    echo "  created backend/.env from .env.example"
  fi
  if [[ ! -f "${ROOT_DIR}/frontend/.env" && -f "${ROOT_DIR}/frontend/.env.example" ]]; then
    cp "${ROOT_DIR}/frontend/.env.example" "${ROOT_DIR}/frontend/.env"
    echo "  created frontend/.env from .env.example"
  fi
}

start_service() {
  local name="$1"
  local workdir="$2"
  local cmd="$3"
  local port="$4"
  local health_url="${5:-}"

  ensure_run_dirs

  # Already healthy on the expected port — adopt the listener pid and skip relaunch.
  local listening
  listening="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${listening}" ]]; then
    echo "${listening}" >"$(pid_file "${name}")"
    if [[ -n "${health_url}" ]] && curl -fsS --max-time 1 "${health_url}" >/dev/null 2>&1; then
      echo "  • ${name} already running (pid ${listening}, port ${port})"
      return 0
    fi
  fi

  local existing
  existing="$(read_pid "${name}" || true)"
  if is_pid_running "${existing}"; then
    echo "  • ${name} already running (pid ${existing})"
    return 0
  fi

  free_port "${port}"
  rm -f "$(pid_file "${name}")"

  # Launch in workdir; keep the launcher pid, then rebind to the port listener
  # after ready (npm/eve often leave a different long-lived node process).
  (
    cd "${workdir}" || exit 1
    # shellcheck disable=SC2086
    nohup ${cmd} >"$(log_file "${name}")" 2>&1 &
    echo $! >"$(pid_file "${name}")"
  )

  local pid
  pid="$(read_pid "${name}")"
  echo "  → started ${name} (launcher pid ${pid}, port ${port})"
  echo "    log: $(log_file "${name}")"

  if [[ -n "${health_url}" ]]; then
    wait_http "${health_url}" "${name}" || true
  else
    sleep 0.5
  fi

  listening="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${listening}" ]]; then
    echo "${listening}" >"$(pid_file "${name}")"
    echo "  • ${name} listening pid=${listening}"
  fi
}

stop_service() {
  local name="$1"
  local port="${2:-}"
  local pid
  pid="$(read_pid "${name}" || true)"

  if is_pid_running "${pid}"; then
    echo "  → stopping ${name} (pid ${pid})"
    kill_tree "${pid}"
  else
    echo "  • ${name} not running via pidfile"
  fi
  rm -f "$(pid_file "${name}")"

  if [[ -n "${port}" ]]; then
    free_port "${port}"
  fi
}

service_status_line() {
  local name="$1"
  local port="$2"
  local pid
  pid="$(read_pid "${name}" || true)"
  local listening
  listening="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

  if [[ -n "${listening}" ]]; then
    # Heal stale/missing pidfiles so stop/restart keep working.
    echo "${listening}" >"$(pid_file "${name}")"
    echo "  ✓ ${name}  pid=${listening}  port=${port}"
    return 0
  fi

  if is_pid_running "${pid}"; then
    echo "  ~ ${name}  pid=${pid} (process up, port ${port} not listening yet)"
  else
    rm -f "$(pid_file "${name}")"
    echo "  ✗ ${name}  stopped"
  fi
}
