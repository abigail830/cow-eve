# Unified local control for frontend + backend.

From repo root:

```bash
./scripts/start.sh      # parse-pipeline :8091, omni :2000, frontend :5273
./scripts/stop.sh
./scripts/restart.sh
./scripts/status.sh
```

Optional target: `all` | `backend` | `frontend` | `omni` | `parse-pipeline`

- **backend** = parse-pipeline + omni (same stack as omni/all for the API).
- Set `START_PARSE_PIPELINE=0` to start omni/backend/all without parse-pipeline (attachment parse will not work until it is running).

`start` / `restart` for `all` | `backend` | `omni` run `npm run db:migrate` in `backend/` when `DATABASE_URL` is set (env or `backend/.env`). Frontend-only and parse-pipeline-only skip migrate.

First-time parse-pipeline: run `backend/scripts/setup_parse_inline.sh` to create `parse-pipeline/.venv`.

Logs and pidfiles live in `.run/` (gitignored).
