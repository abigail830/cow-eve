# Unified local control for frontend + backend.
#
# From repo root:
#
#   ./scripts/start.sh      # omni :2000, content-studio :2001, frontend :5273
#   ./scripts/stop.sh
#   ./scripts/restart.sh
#   ./scripts/status.sh
#
# Optional target: all | backend | frontend | omni | content-studio
#
# `start` / `restart` for all|backend|omni|content-studio run `npm run db:migrate`
# in backend/ when DATABASE_URL is set (env or backend/.env). Frontend-only skips it.
#
# Logs & pidfiles live in `.run/` (gitignored).
