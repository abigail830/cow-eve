# Phase 0 spike: Vercel Connect × Notion / HubSpot MCP

**Superseded:** Product decision is **platform PKCE for both Notion and HubSpot**. See [INTEGRATIONS.md](./INTEGRATIONS.md).

**Date:** 2026-10-04  
**Goal:** Validate whether cow-eve can use Eve `connect()` + Vercel Connect for Notion/HubSpot MCP (vs platform PKCE).

## Executive conclusion

| Integration | Vercel Connect (Eve `connect()`) | Recommendation |
|-------------|-----------------------------------|----------------|
| **Notion MCP** | **Supported** — managed connector `connection-method mcp`, Vercel registers OAuth | **Go Connect path** for Phase 1 |
| **HubSpot MCP** (`https://mcp.hubspot.com`) | **Not supported as managed MCP**; URL-based create fails (no OAuth DCR); `hubspot --connection-method oauth` requires **BYO** `clientId` / `clientSecret` | **Hybrid:** BYO OAuth app + Connect custom/oauth connector **or** platform PKCE (agent-platform parity) until Connect publishes HubSpot MCP like Notion |

**Cow-eve gap before end-to-end Notion in chat:** frontend has no `connection.authorization_required` / Connect sign-in UI yet (only HITL question/approval). Backend `@vercel/connect` is installed but unused in agent connections.

---

## What we ran (CLI 62.2.0)

### Notion — success

```bash
vercel connect create notion --connection-method mcp --name cow-eve-notion-mcp --json
```

Result:

- **UID (use in Eve):** `notion/cow-eve-notion-mcp`
- **Client id:** `scl_Zg0XCkrdzDyr5TzIR6CTg`
- **type:** `oauth`, **target:** `mcp`, **connectionMethod:** `mcp`
- **supportedSubjectTypes:** `user` only

Attached to Vercel project **`cow-eve`** (`prj_PlsoHUmCbEVjWeg32RUmgXXIWmMO`), all environments:

```bash
vercel connect attach notion/cow-eve-notion-mcp --project cow-eve -y --json
```

Eve connection sketch:

```ts
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.notion.com/mcp",
  description: "Notion workspace — search, read, create, update pages.",
  auth: connect("notion/cow-eve-notion-mcp"),
});
```

MCP URL matches agent-platform / Notion docs; auth is user OAuth via Connect (not bearer API key).

### HubSpot — blocked on Connect managed MCP

```bash
vercel connect create hubspot --connection-method mcp --name cow-eve-hubspot-mcp
# Error: Unknown connection method "mcp" for "hubspot". Available: oauth, api-key
```

Custom MCP host (same OAuth server as agent-platform):

```bash
vercel connect create mcp.hubspot.com --name cow-eve-hubspot-mcp --json
# Error: OAuth server does not support Dynamic Client Registration
```

HubSpot API OAuth (not necessarily MCP endpoint):

```bash
vercel connect create hubspot --connection-method oauth --name cow-eve-hubspot-oauth --json
# Error: Missing credentials — need clientId, clientSecret via --data @file
```

**Implication:** HubSpot remote MCP still needs a **developer-registered OAuth app** (as in agent-platform `HUBSPOT_MCP_CLIENT_*`). Connect can store tokens only after BYO client credentials; there is no one-shot `connection-method mcp` equivalent to Notion today.

---

## Eve / deployment prerequisites (Notion path)

1. **User principal on Eve sessions** — already required for hybrid-search; `connect()` defaults to user-scoped interactive OAuth ([Eve connections overview](backend/node_modules/eve/docs/connections/overview.mdx)).
2. **Vercel project link + attach** — connector must be attached to the project that runs the Eve agent (done for `cow-eve` + Notion).
3. **Runtime OIDC** — Connect `getToken` on Vercel uses deployment OIDC; local dev may need `vercel env pull` / linked project or documented dev workflow.
4. **Chat UI** — implement Eve authorization lifecycle (sign-in affordance, resume turn); Integrations page can show connector UID + “authorize in chat” copy.

---

## Recommended plan adjustment

- **Phase 1:** Notion via `@fde/notion` (or omni `connections/notion.ts`) + `connect("notion/cow-eve-notion-mcp")` + authorization UI.
- **Phase 2 HubSpot:** Spike BYO `vercel connect create hubspot --connection-method oauth --data @…` against a HubSpot MCP OAuth app; if token audience/scopes do not work with `https://mcp.hubspot.com/mcp`, keep **platform PKCE** for HubSpot only (Connect for Notion, PKCE for HubSpot) behind the same Eve `getToken` abstraction if needed.

---

## References

- [Vercel Connect CLI](https://vercel.com/docs/cli/connect)
- [Vercel Connect — Notion](https://vercel.com/connect/notion)
- [Vercel Connect — HubSpot](https://vercel.com/connect/hubspot)
- agent-platform Notion/HubSpot MCP OAuth URLs (PKCE reference only)
