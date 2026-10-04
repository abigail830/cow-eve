import { defineMcpClientConnection } from "eve/connections";
import { resolveIntegrationMcpAccessToken } from "#platform/composition/public-api.js";

export function defineOAuthMcpConnection(input: {
  integrationId: string;
  userId: string;
  agentId: string;
  url: string;
  description: string;
  connectionName: string;
  toolAllowList: readonly string[];
  notConnectedMessage: string;
}) {
  return defineMcpClientConnection({
    url: input.url,
    description: input.description,
    instanceKey: `${input.userId}:${input.agentId}:${input.integrationId}`,
    auth: {
      credentialOwner: "user",
      getToken: async () => {
        const resolved = await resolveIntegrationMcpAccessToken(
          input.userId,
          input.agentId,
          input.integrationId,
        );
        if (!resolved) {
          throw new Error(input.notConnectedMessage);
        }
        return {
          token: resolved.token,
          expiresAt: resolved.expiresAtMs,
        };
      },
    },
    tools: { allow: [...input.toolAllowList] },
  });
}
