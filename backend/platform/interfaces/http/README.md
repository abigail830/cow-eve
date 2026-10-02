# Platform HTTP (Eve channel routes)

Public REST handlers live here as `register*Routes(ctx)` modules. Eve agents should import `registerPublicApiRoutes` only — `agents/omni/agent/channels/platform.ts` is a thin `defineChannel` wrapper.

Modules include auth, agents, settings, integrations, memory, chat, schedule, project, attachments (incl. audio captures), artifacts, workspace, and parse-internal routes.

## Adding a route

1. Add handler in the appropriate `routes/register-*-routes.ts` (or create a new module).
2. Call use-cases via `platform/composition/public-api` only — no direct repository access from routes.
3. Register CORS preflight in the **same file** when needed (see below).

## CORS preflight (Eve compile)

Eve rejects duplicate `OPTIONS` for the same path pattern (`compile/channel-route-duplicate`).

- Do **not** add `ctx.preflight(path)` if that path already has handlers that cause Eve to emit OPTIONS for the same pattern.
- Prefer co-locating `preflight(...)` with the routes in each `register-*-routes.ts` file.
- Static paths (e.g. `/api/projects/summary`) must be registered before param routes (`/:id`) in the same module.
- Do **not** register both `GET /api/foo/summary` and `GET /api/foo/:id` — Eve treats them as duplicate `GET /api/foo/:id`. Use `GET /api/foo/detail/:id` for single-resource reads instead.
