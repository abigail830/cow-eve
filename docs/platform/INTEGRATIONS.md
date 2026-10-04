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

1. Register an OAuth app with the provider for the hosted MCP endpoints ([Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp), HubSpot MCP).
2. Set redirect URI on the provider to the **platform backend** callback:
   - `https://<backend-host>/api/integrations/notion/callback`
   - `https://<backend-host>/api/integrations/hubspot/callback`
3. Configure [`backend/.env.example`](../../backend/.env.example) variables (`NOTION_MCP_*`, `HUBSPOT_MCP_*`, optional `INTEGRATION_SUCCESS_REDIRECT` for the frontend after callback).

## Eve runtime (source of truth for “which agent gets which integration”)

1. Add or remove a file under `backend/agents/<eveAgent>/agent/connections/` (Eve connections — see `eve` package docs under `connections/`).
2. Platform maps the filename to a catalog id (`notion.ts` → `notion`, `hybrid-search.ts` → `hybrid_search`) and uses that set for **Customize → Integrations** and runtime token scope for that sidebar agent ([`AGENT_REGISTRY`](../../backend/platform/domain/registry/agent.entity.ts) `id` → `eveAgent` directory).

Catalog [`integration-catalog.ts`](../../backend/platform/domain/integration/integration-catalog.ts) holds display copy, auth kind, and OAuth/API field definitions only — not per-agent visibility.

**To enable HubSpot for omni:** keep [`hubspot.ts`](../../backend/agents/omni/agent/connections/hubspot.ts). **To hide it:** delete or rename that file (no platform catalog edit).

**Future sidebar agent:** add `agents/<eveAgent>/` with its own `agent/connections/`; registry entry must point `eveAgent` at that directory.

## Related

- Phase 0 Connect spike (superseded): [INTEGRATIONS_PHASE0_SPIKE.md](./INTEGRATIONS_PHASE0_SPIKE.md)
