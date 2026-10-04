# Cow Eve Backend

Eve agent workspace powering the Agent Platform.

## Agents

| Id | Role | Local port |
|----|------|------------|
| `omni` | FDE(HaoYu): Unified entry + platform HTTP (`/api/*`) | 2000 |
| `research` | Ann Researcher: plans + published reports | 2002 |
| `content-studio` | Document / one-pager specialist | 2001 |

LRQA Brief/CDP skills and Project templates: [docs/research/PROJECT_TEMPLATES.md](../docs/research/PROJECT_TEMPLATES.md).

## Prerequisites

- Node.js 24+
- OpenAI-compatible model endpoint (DeepSeek / Qwen / custom). Configure in the web UI: **Settings → Model**. API keys are AES-GCM encrypted at rest under `platform/data/`.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # set JWT_SECRET, FRONTEND_ORIGIN, DATABASE_URL, Upstash Redis, etc.
npm run db:migrate     # apply Neon schema (requires DATABASE_URL)
```

## Dev

Run both agents (two terminals):

```bash
npm run dev:omni
npm run dev:research
npm run dev:content-studio
```

Do **not** add `package.json` under `agents/<name>/` (e.g. after `npm install` in that folder). Eve treats that as a separate npm root and breaks the workspace layout.

`npm run dev:omni` / `dev:research` `cd` into `agents/<name>/` with `EVE_INTERNAL_AGENT_WORKSPACE_MEMBER=1` (same as Vercel), matching the member build used on deploy.

### Known Eve issue: workspace member `defineWorkflowTool` ids

Research **`research_retrieve`** is a **`defineWorkflowTool`** (required for `ctx.agent("retrieve")`). Ledger files in sandbox are the cross-context source of truth; run **`sync_research_ledger`** after retrieves. Without the patch below, retrieve fails with *not registered as a workflow* ([#3740](https://github.com/vercel/eve/issues/3740)).

Workspace-member **`defineWorkflowTool`** ids mismatch when Eve stamps **two different workflow ids** for the same tool:

| Side | Example id |
|------|------------|
| Tool catalog / dispatch | `workflow//./agents/research/agent/tools/research_retrieve//execute` |
| Workflow runtime registration | `workflow//./agent/tools/research_retrieve//execute` |

This layout (`backend/agents/research/agent/`, **no** `package.json` under `agents/research/`) matches [arpoma16/eve-workflow-id-repro](https://github.com/arpoma16/eve-workflow-id-repro) and is required for multi-agent Vercel routing. Adding a member `package.json` makes Eve treat the folder as a **standalone app** (`No eve project contains …/agents/research`) and drops it from the host workspace — so the #3740 “give each member a package.json” workaround does **not** apply here. The real upstream fix is the compiler change in [vercel/eve#3740](https://github.com/vercel/eve/issues/3740) / [PR #3742](https://github.com/vercel/eve/pull/3742) (community rebases on 0.69+: [88f5d0e](https://github.com/arpoma16/eve/commit/88f5d0e1c316056db836a4288a309443e95b443a)).

**Upstream:** [vercel/eve#3740](https://github.com/vercel/eve/issues/3740) (open, P1). Related: [#3628](https://github.com/vercel/eve/issues/3628), [PR #3742](https://github.com/vercel/eve/pull/3742) (fix in progress; not fully merged for 0.69+ / 0.70.x at time of writing). Repro: [arpoma16/eve-workflow-id-repro](https://github.com/arpoma16/eve-workflow-id-repro).

**cow-eve mitigation (until `eve` is fixed):**

- **`vercel.ts`** (via `withEve`) appends the workflow-id patch to **`eve-research`’s `buildCommand`** — this is what **production Vercel actually runs** (evaluated before per-service builds). Do not rely on patching `.vercel/output/config.json` alone.
- `npm run build` → `inject-vercel-research-patch-build.mjs` (same suffix for local Build Output API) → `patch:research-workflow-id`. Patch scans `agents/research/.output`, `.eve/vercel-services/eve-research/.vercel/output`, etc., and **fails the build** if ids still mismatch.
- `npm run dev:research` → [`scripts/dev-research.sh`](scripts/dev-research.sh) runs Eve dev plus a **2s patch loop** (hot reload rewrites the wrong id).
- `./scripts/restart.sh research` also patches once after health.
- Manual: `cd backend && npm run patch:research-workflow-id`
- After restart/patch, always use a **new chat**; do not edit research agent sources during an in-flight turn.

Implementation: [`scripts/patch-eve-research-workflow-id.mjs`](scripts/patch-eve-research-workflow-id.mjs). Remove once upstream `eve` fixes #3740.

More context: [docs/research/RESEARCH_DURABILITY.md](../docs/research/RESEARCH_DURABILITY.md).

**Validate retrieve MCP (no chat turn):** `npm run test:research-mcp` from `backend/`. **Fail-fast budgets:** `RESEARCH_FAIL_FAST=1 npm run dev:research` (≤2 retrieves per turn; no workflow wall-clock timeout).

Platform APIs (served by omni):

- `POST /api/auth/login` — `{ email, password }` → JWT
- `GET /api/auth/me` — Bearer JWT
- `GET /api/agents` — agent registry
- `GET /api/chats?agentId=` — chat history for the current user
- `GET /api/chats/:id` — chat detail (+ projected events)
- `DELETE /api/chats/:id` — soft-delete a chat

Eve session APIs (per process):

- `http://127.0.0.1:2000/eve/v1/*` — omni
- `http://127.0.0.1:2002/eve/v1/*` — research
- `http://127.0.0.1:2001/eve/v1/*` — content-studio

Trigger the sample schedule (omni, while `eve dev` is running):

```bash
curl -X POST http://127.0.0.1:2000/eve/v1/dev/schedules/heartbeat
```

## Env

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | HMAC secret for platform JWT (≥16 chars). **Required at Vercel Runtime** (Production/Preview). Build no longer requires it. |
| `FRONTEND_ORIGIN` | Extra CORS origins, comma-separated (defaults always include local + `https://fde-desk.vercel.app`) |
| `CONTENT_STUDIO_URL` | Omni → Content Studio remote base (default `http://127.0.0.1:2001`) |
| `DATABASE_URL` | Neon Postgres connection string for chat history |
| `BLOB_READ_WRITE_TOKEN` | **Required on Vercel** for artifact download/preview (docx/pptx/html). Create a Blob store in the Vercel project and add the token. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for Eve memory |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `AI_GATEWAY_API_KEY` | Model access when not using Vercel OIDC |
| `PLATFORM_API_BASE_URL` | Omni `@fde/projects` / `@fde/schedules` OpenAPI tools (e.g. `https://cow-eve.vercel.app`). On Vercel, defaults to `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` when unset. |
| `PARSE_PIPELINE_DISPATCH` | On Vercel use **`gha`** (not `service`). Local dev: `service` + `PARSE_PIPELINE_SERVICE_*`. `auto` picks gha when GitHub env is set; on Vercel without service keys, `auto` also expects gha. |
| `GITHUB_TOKEN` | PAT with **Actions: read and write** on `GITHUB_REPO` (for `workflow_dispatch`) |
| `GITHUB_REPO` | e.g. `abigail830/cow-eve` |
| `GITHUB_WORKFLOW_FILE` | Default `parse-pipeline-run-job.yml` |
| `GITHUB_REF` | Branch for dispatch (default `main`) |
| `PARSE_PIPELINE_PUBLIC_BASE_URL` | **Backend** origin GHA uses to call `/internal/parse/v1/*` (not the frontend SPA). If unset on Vercel, falls back to `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`. |

Logged-in clients can inspect effective parse settings (no secrets) via `GET /api/chat-attachments/upload-policy` → `policy.parsePipeline`.

## Deploy

Link and deploy with Eve / Vercel from this directory (`eve link`, `eve deploy`), or Git push with Root Directory `backend`. [`vercel.ts`](vercel.ts) publishes `/api/*` and `/internal/parse/v1/*` to the `eve-omni` service (platform API + attachment parse for GHA/local workers). Set the env vars above on the Vercel project. Point `CONTENT_STUDIO_URL` at `https://<backend-host>/eve/content-studio` in production.

For GitHub Actions parse dispatch, set `PARSE_PIPELINE_PUBLIC_BASE_URL` on the **backend** deployment origin (where `/api/agents` works). A frontend-only Vercel project will return 404 for `/internal/parse/v1/run/...`.

Eve configures the workflow flow route to `maxDuration: "max"` (Vercel Pro ceiling, typically 300s). Do **not** add a classic `vercel.json` `functions.**/*` maxDuration — Eve uses Build Output services, and that pattern fails the build (`unmatched-function-pattern`).

After setting `DATABASE_URL`, run `npm run db:migrate` once against Neon (locally or in CI) before relying on chat history.

## Preset user

Login only (no registration). Password is stored as bcrypt in `platform/domain/auth/user.entity.ts`.

Platform code follows DDD-style layers — see `platform/ARCHITECTURE.md`. Agent code should import from `platform/composition/public-api.ts` only.
