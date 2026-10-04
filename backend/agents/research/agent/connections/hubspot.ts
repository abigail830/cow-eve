import { defineDynamic } from "eve/connections";
import {
  getHubspotMcpUrl,
  INTEGRATION_HUBSPOT,
  resolveIntegrationMcpAccessToken,
} from "#platform/composition/public-api.js";
import { defineOAuthMcpConnection } from "../lib/oauth-mcp-connection.js";
import { resolveAgentIdForSession } from "../lib/resolve-agent-id.js";

const HUBSPOT_TOOL_ALLOW = [
  "get_user_details",
  "search_crm_objects",
  "get_crm_objects",
  "manage_crm_objects",
  "search_properties",
  "get_properties",
  "search_owners",
  "get_tool_instructions",
];

async function hubspotConnectionsForSession(ctx: {
  session: {
    id: string;
    auth: { current?: { principalType?: string; principalId?: string } | null };
  };
}) {
  const caller = ctx.session.auth.current;
  if (caller?.principalType !== "user" || !caller.principalId) {
    return null;
  }
  const agentId = await resolveAgentIdForSession({
    userId: caller.principalId,
    eveSessionId: ctx.session.id,
  });
  if (!agentId) return null;
  const token = await resolveIntegrationMcpAccessToken(
    caller.principalId,
    agentId,
    INTEGRATION_HUBSPOT,
  );
  if (!token) return null;
  return {
    hubspot: defineOAuthMcpConnection({
      integrationId: INTEGRATION_HUBSPOT,
      userId: caller.principalId,
      agentId,
      url: getHubspotMcpUrl(),
      description: "HubSpot CRM — search and manage CRM objects via MCP.",
      connectionName: "hubspot",
      toolAllowList: HUBSPOT_TOOL_ALLOW,
      notConnectedMessage:
        "HubSpot is not connected for this agent. Open Customize → Integrations and connect HubSpot.",
    }),
  };
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => hubspotConnectionsForSession(ctx),
    "turn.started": async (_event, ctx) => hubspotConnectionsForSession(ctx),
  },
});
