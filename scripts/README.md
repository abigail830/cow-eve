# Unified local control for frontend + backend.

From repo root:

```bash
./scripts/start.sh      # parse-pipeline :8091, proposal-knowledge :8093, omni :2000, research :2002, frontend :5273
./scripts/stop.sh
./scripts/restart.sh
./scripts/status.sh
```

Optional target: `all` | `backend` | `frontend` | `omni` | `research` | `parse-pipeline` | `proposal-knowledge`

- **backend** = parse-pipeline + proposal-knowledge + omni + research (platform API on omni :2000; Ann Researcher Eve on :2002).
- Set `START_PARSE_PIPELINE=0` to start omni/backend/all without parse-pipeline (attachment parse will not work until it is running).
- Set `START_PROPOSAL_KNOWLEDGE=0` to skip proposal-knowledge when starting omni/backend/all.

`start` / `restart` for `all` | `backend` | `omni` | `proposal-knowledge` run:

1. `npm run db:migrate` in `backend/` when `DATABASE_URL` is set (env or `backend/.env`).
2. `proposal-knowledge db init` when `proposal-knowledge/.env` has `DATABASE_URL` (SQLAlchemy `create_all`, idempotent).

First-time venvs:

- `backend/scripts/setup_parse_inline.sh` → `parse-pipeline/.venv`
- `backend/scripts/setup_proposal_knowledge.sh` → `proposal-knowledge/.venv`

Logs and pidfiles live in `.run/` (gitignored).
