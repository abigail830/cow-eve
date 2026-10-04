import { defineDynamic } from "eve/connections";
import {
  getNotionMcpUrl,
  INTEGRATION_NOTION,
  resolveIntegrationMcpAccessToken,
} from "#platform/composition/public-api.js";
import { defineOAuthMcpConnection } from "../lib/oauth-mcp-connection.js";
import { resolveAgentIdForSession } from "../lib/resolve-agent-id.js";

const NOTION_TOOL_ALLOW = [
  "notion-search",
  "notion-fetch",
  "notion-create-pages",
  "notion-update-page",
];

async function notionConnectionsForSession(ctx: {
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
    INTEGRATION_NOTION,
  );
  if (!token) return null;
  return {
    notion: defineOAuthMcpConnection({
      integrationId: INTEGRATION_NOTION,
      userId: caller.principalId,
      agentId,
      url: getNotionMcpUrl(),
      description:
        "Notion workspace — search, read, create, and update pages via MCP.",
      connectionName: "notion",
      toolAllowList: NOTION_TOOL_ALLOW,
      notConnectedMessage:
        "Notion is not connected for this agent. Open Customize → Integrations and connect Notion.",
    }),
  };
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => notionConnectionsForSession(ctx),
    "turn.started": async (_event, ctx) => notionConnectionsForSession(ctx),
  },
});
