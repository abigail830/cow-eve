import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  getHybridSearchApiKey,
  getHybridSearchMcpUrl,
} from "../../../../platform/infrastructure/config/mcp.config.js";

export default defineDynamic({
  events: {
    "session.started": () => {
      const connections: Record<
        string,
        ReturnType<typeof defineMcpClientConnection>
      > = {};

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

      return connections;
    },
  },
});
