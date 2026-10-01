import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  resolveHybridSearchCredentials,
} from "#platform/application/integration/user-integration.use-case.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
      const userId =
        auth?.principalType === "user" ? auth.principalId : null;

      const { url, apiKey } = await resolveHybridSearchCredentials(userId);
      if (!url || !apiKey) return null;

      return {
        "hybrid-search": defineMcpClientConnection({
          url,
          description:
            "Knowledge-base hybrid search — list knowledge bases and retrieve grounded answers.",
          instanceKey: userId ?? "hybrid-search",
          auth: {
            credentialOwner: "user",
            getToken: async () => ({ token: apiKey }),
          },
        }),
      };
    },
  },
});
