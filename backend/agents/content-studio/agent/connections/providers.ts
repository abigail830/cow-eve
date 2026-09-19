import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  getHybridSearchApiKey,
  getHybridSearchMcpUrl,
  getNotionMcpUrl,
  getZhipuApiKey,
  getZhipuWebSearchMcpUrl,
} from "#platform/infrastructure/config/mcp.config.js";

export default defineDynamic({
  events: {
    "session.started": () => {
      const connections: Record<string, ReturnType<typeof defineMcpClientConnection>> = {};

      const hybridSearchUrl = getHybridSearchMcpUrl();
      const hybridSearchKey = getHybridSearchApiKey();
      if (hybridSearchUrl && hybridSearchKey) {
        connections["hybrid-search"] = defineMcpClientConnection({
          url: hybridSearchUrl,
          description:
            "Knowledge-base hybrid search — list knowledge bases and retrieve grounded answers.",
          instanceKey: "hybrid-search",
          auth: {
            credentialOwner: "app",
            getToken: async () => ({ token: hybridSearchKey }),
          },
        });
      }

      const zhipuUrl = getZhipuWebSearchMcpUrl();
      const zhipuKey = getZhipuApiKey();
      if (zhipuUrl && zhipuKey) {
        connections["zhipu-web-search"] = defineMcpClientConnection({
          url: zhipuUrl,
          description: "Zhipu web search for timely public information when KB coverage is insufficient.",
          instanceKey: "zhipu-web-search",
          headers: {
            Authorization: zhipuKey,
          },
        });
      }

      connections.notion = defineMcpClientConnection({
        url: getNotionMcpUrl(),
        description: "Notion workspace — search, fetch, and create or update pages.",
        instanceKey: "notion",
        auth: connect("notion"),
      });

      return connections;
    },
  },
});
