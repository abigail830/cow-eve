# Cow Eve Backend

Eve agent workspace powering the Agent Platform.

## Agents

| Id | Role | Local port |
|----|------|------------|
| `omni` | Unified entry + platform HTTP (`/api/*`) | 2000 |
| `content-studio` | Document / one-pager specialist | 2001 |

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
npm run dev:content-studio
```

Platform APIs (served by omni):

- `POST /api/auth/login` — `{ email, password }` → JWT
- `GET /api/auth/me` — Bearer JWT
- `GET /api/agents` — agent registry
- `GET /api/chats?agentId=` — chat history for the current user
- `GET /api/chats/:id` — chat detail (+ projected events)
- `DELETE /api/chats/:id` — soft-delete a chat

Eve session APIs (per process):

- `http://127.0.0.1:2000/eve/v1/*` — omni
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
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for Eve memory |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `AI_GATEWAY_API_KEY` | Model access when not using Vercel OIDC |

## Deploy

Link and deploy with Eve / Vercel from this directory (`eve link`, `eve deploy`), or Git push with Root Directory `backend`. [`vercel.ts`](vercel.ts) publishes `/api/*` to the `eve-omni` service (platform login/chats/settings). Set the env vars above on the Vercel project. Point `CONTENT_STUDIO_URL` at `https://<backend-host>/eve/content-studio` in production.

Eve configures the workflow flow route to `maxDuration: "max"` (Vercel Pro ceiling, typically 300s). Do **not** add a classic `vercel.json` `functions.**/*` maxDuration — Eve uses Build Output services, and that pattern fails the build (`unmatched-function-pattern`).

After setting `DATABASE_URL`, run `npm run db:migrate` once against Neon (locally or in CI) before relying on chat history.

## Preset user

Login only (no registration). Password is stored as bcrypt in `platform/domain/auth/user.entity.ts`.

Platform code follows DDD-style layers — see `platform/ARCHITECTURE.md`. Agent code should import from `platform/composition/public-api.ts` only.
