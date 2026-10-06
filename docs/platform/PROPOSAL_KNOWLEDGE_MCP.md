# Proposal Knowledge MCP (platform wiring)

Cow Eve talks to the **proposal-knowledge** service only via:

- **Bearer API key** (`pk_live_…` or env bootstrap key)
- **Two MCP URLs** (Streamable HTTP, include `/mcp` suffix)

There is **no** shared TypeScript/Python types and **no** imports from `proposal-knowledge/` into `backend/platform`.

## Environment (server / Vercel backend)

Optional defaults when users have not set integration URLs:

| Variable | Example |
|----------|---------|
| `PROPOSAL_CATALOG_MCP_URL` | `https://your-pk.vercel.app/api/mcp/catalog/mcp` |
| `PROPOSAL_CV_MCP_URL` | `https://your-pk.vercel.app/api/mcp/cv/mcp` |
| `PROPOSAL_KNOWLEDGE_API_KEY` | `pk_live_…` (omit `Bearer`) |

## User integration (`proposal_knowledge`)

Wired on **Omni** via `agents/omni/agent/connections/proposal-knowledge.ts`.

Users can override catalog/CV MCP URLs in Integrations; the API key is stored encrypted per user. Platform env vars act as fallback.

## Key provisioning (on proposal-knowledge service)

Keys are **created on the PK service**, not in cow-eve:

```bash
proposal-knowledge keys create --label prod-omni --bus INCORP-HK
```

Admin HTTP: `POST /internal/v1/api-keys` with `Authorization: Bearer <PROPOSAL_KNOWLEDGE_ADMIN_KEY>`.

Paste the returned secret into Integrations or `PROPOSAL_KNOWLEDGE_API_KEY` for dev.

## Smoke

Local PK: `proposal-knowledge serve --port 8093`

```bash
curl -s http://127.0.0.1:8093/health
```

MCP requires Streamable HTTP client (Eve MCP client or `proposal-knowledge` pytest suite).
