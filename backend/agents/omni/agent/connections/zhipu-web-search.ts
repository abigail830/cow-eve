import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  resolveZhipuWebSearchApiKey,
} from "#platform/application/integration/user-integration.use-case.js";
import { getZhipuWebSearchMcpUrl } from "#platform/infrastructure/config/mcp.config.js";
import { zhipuMcpAuthorizationHeader } from "#platform/domain/integration/zhipu-mcp-auth.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
      const userId =
        auth?.principalType === "user" ? auth.principalId : null;

      const zhipuUrl = getZhipuWebSearchMcpUrl();
      const rawKey = await resolveZhipuWebSearchApiKey(userId);
      const authorization = rawKey ? zhipuMcpAuthorizationHeader(rawKey) : "";
      if (!zhipuUrl || !authorization) return null;

      return {
        "zhipu-web-search": defineMcpClientConnection({
          url: zhipuUrl,
          description:
            "Zhipu web search for timely public information when KB coverage is insufficient.",
          instanceKey: userId ?? "zhipu-web-search",
          headers: {
            Authorization: authorization,
          },
        }),
      };
    },
  },
});
