import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import extension from "../extension.js";

export default defineDynamic({
  events: {
    "session.started": () => {
      const { hybridSearchUrl, hybridSearchApiKey } = extension.config;
      const connections: Record<
        string,
        ReturnType<typeof defineMcpClientConnection>
      > = {};

      if (hybridSearchUrl && hybridSearchApiKey) {
        connections["hybrid-search"] = defineMcpClientConnection({
          url: hybridSearchUrl,
          description:
            "Knowledge-base hybrid search — list knowledge bases and retrieve grounded answers.",
          instanceKey: "hybrid-search",
          auth: {
            credentialOwner: "app",
            getToken: async () => ({ token: hybridSearchApiKey }),
          },
        });
      }

      return connections;
    },
  },
});
