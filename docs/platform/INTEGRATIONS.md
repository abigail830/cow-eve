# Platform integrations (OAuth PKCE + API keys)

Cow Eve stores per-user integration credentials in Postgres (`user_integrations`) and exposes them to Eve agents through dynamic MCP connections.

## Auth kinds

| Kind | Examples | User flow |
|------|----------|-----------|
| `api_key` | Hybrid Search, Zhipu Web Search | Customize → Integrations → enter keys |
| `oauth` | Notion, HubSpot MCP | Customize → Integrations → **Connect** (PKCE) |

OAuth tokens are encrypted at rest; the model never sees bearer tokens (Eve connection `getToken`).

## Credential scope

| Scope | Storage | Examples |
|-------|---------|----------|
| `user` | `user_integrations` | Hybrid Search, Zhipu API keys (shared by all agents) |
| `agent` | `agent_integrations` (PK: user + agent + integration) | Notion, HubSpot OAuth per agent |

Customize → Integrations always requires `agentId`. Eve resolves the active agent from the chat tied to the Eve session when mounting MCP connections.

## OAuth setup (Notion / HubSpot)

### Notion MCP (dynamic client registration)

1. From `backend/`: `npm run register:notion-mcp` (or POST to `https://mcp.notion.com/register` with your redirect URI).
2. Copy printed `NOTION_MCP_*` lines into `backend/.env`.
3. Redirect must be the **platform backend** callback, e.g. `http://127.0.0.1:2000/api/integrations/notion/callback` (local) or `https://<backend-host>/api/integrations/notion/callback` (prod).

### HubSpot MCP (MCP Auth App in HubSpot — no DCR)

1. In your HubSpot account: **Development** → **Create MCP auth app** ([remote MCP guide](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server)).
2. Set **Redirect URL** to the same pattern as Notion but `hubspot` in the path, e.g. `http://127.0.0.1:2000/api/integrations/hubspot/callback` (local). **Production must use `https://`** (e.g. `https://cow-eve.vercel.app/api/integrations/hubspot/callback`) — HubSpot rejects `http://` on public hosts. The value in HubSpot must match `HUBSPOT_MCP_REDIRECT_URI` on the backend (platform upgrades `http://*.vercel.app` to `https` at runtime, but HubSpot’s app settings still need the HTTPS URL).
3. On the app details page, copy **Client ID** and **Client secret** into `backend/.env` as `HUBSPOT_MCP_CLIENT_*` (see [`.env.example`](../../backend/.env.example)).
4. Optional: `INTEGRATION_SUCCESS_REDIRECT` (frontend after callback, e.g. `http://127.0.0.1:5273`).

**Quote `DATABASE_URL` in `.env` if it contains `&`**, so `source .env` during `./scripts/restart.sh omni` loads all variables.

Restart omni after env changes. Users connect per agent under Customize → Integrations (agent-scoped credentials).

## Eve runtime (source of truth for “which agent gets which integration”)

1. Add or remove a file under `backend/agents/<eveAgent>/agent/connections/` (Eve connections — see `eve` package docs under `connections/`).
2. Platform maps the filename to a catalog id (`notion.ts` → `notion`, `hybrid-search.ts` → `hybrid_search`) and uses that set for **Customize → Integrations** and runtime token scope for that sidebar agent ([`AGENT_REGISTRY`](../../backend/platform/domain/registry/agent.entity.ts) `id` → `eveAgent` directory). On **Vercel/serverless**, the repo `agents/` tree is not on disk at runtime; `npm run build` runs `sync:integrations` to refresh [`wired-integrations.manifest.ts`](../../backend/platform/infrastructure/agents/wired-integrations.manifest.ts) from connection files (local dev still prefers a live directory scan when present).

Catalog [`integration-catalog.ts`](../../backend/platform/domain/integration/integration-catalog.ts) holds display copy, auth kind, and OAuth/API field definitions only — not per-agent visibility.

**To enable HubSpot for omni:** keep [`hubspot.ts`](../../backend/agents/omni/agent/connections/hubspot.ts). **To hide it:** delete or rename that file (no platform catalog edit).

The **research** agent wires HubSpot, hybrid search, and Zhipu web search under [`backend/agents/research/agent/connections/`](../../backend/agents/research/agent/connections/) (no Notion). Connect OAuth per agent in Customize → Integrations when using `agentId=research`.

**Future sidebar agent:** add `agents/<eveAgent>/` with its own `agent/connections/`; registry entry must point `eveAgent` at that directory.

## Related

- Phase 0 Connect spike (superseded): [INTEGRATIONS_PHASE0_SPIKE.md](./INTEGRATIONS_PHASE0_SPIKE.md)
