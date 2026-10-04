import { defineDynamic } from "eve/connections";
import {
  getHubspotMcpUrl,
  INTEGRATION_HUBSPOT,
  resolveIntegrationMcpAccessToken,
} from "#platform/composition/public-api.js";
import { defineOAuthMcpConnection } from "../../../lib/oauth-mcp-connection.js";
import { resolveAgentIdForSession } from "../../../lib/resolve-agent-id.js";

/** Platform sidebar id for Ann Researcher (this connection only ships on research/retrieve). */
const RESEARCH_PLATFORM_AGENT_ID = "research";

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

function eveSessionIdForIntegrations(ctx: {
  session: {
    id: string;
    parent?: { rootSessionId?: string; sessionId?: string } | null;
  };
}): string {
  return (
    ctx.session.parent?.rootSessionId ??
    ctx.session.parent?.sessionId ??
    ctx.session.id
  );
}

async function resolvePlatformAgentId(ctx: {
  session: {
    id: string;
    parent?: { rootSessionId?: string; sessionId?: string } | null;
    auth: { current?: { principalType?: string; principalId?: string } | null };
  };
}): Promise<string | null> {
  const caller = ctx.session.auth.current;
  if (caller?.principalType !== "user" || !caller.principalId) {
    return null;
  }
  const eveSessionId = eveSessionIdForIntegrations(ctx);
  const fromChat = await resolveAgentIdForSession({
    userId: caller.principalId,
    eveSessionId,
  });
  return fromChat ?? RESEARCH_PLATFORM_AGENT_ID;
}

async function hubspotConnectionsForSession(ctx: {
  session: {
    id: string;
    parent?: { rootSessionId?: string; sessionId?: string } | null;
    auth: { current?: { principalType?: string; principalId?: string } | null };
  };
}) {
  const caller = ctx.session.auth.current;
  if (caller?.principalType !== "user" || !caller.principalId) {
    return null;
  }
  const agentId = await resolvePlatformAgentId(ctx);
  if (!agentId) return null;

  const token = await resolveIntegrationMcpAccessToken(
    caller.principalId,
    agentId,
    INTEGRATION_HUBSPOT,
  );
  if (!token) {
    console.warn(
      "[retrieve/hubspot] OAuth token missing for agent",
      agentId,
      "(Customize → Integrations on Ann Researcher)",
    );
    return null;
  }

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
