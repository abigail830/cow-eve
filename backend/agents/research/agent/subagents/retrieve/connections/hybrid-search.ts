import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  resolveHybridSearchCredentials,
} from "#platform/application/integration/user-integration.use-case.js";
import { normalizeHttpUrl } from "#platform/infrastructure/config/mcp.config.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      try {
        const caller = ctx.session.auth.current;
        const userId =
          caller?.principalType === "user" ? caller.principalId : null;

        const { url: rawUrl, apiKey } =
          await resolveHybridSearchCredentials(userId);
        const url = rawUrl ? normalizeHttpUrl(rawUrl) : null;
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
      } catch (err) {
        console.warn(
          "[retrieve/hybrid-search] session.started connection skipped:",
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    },
  },
});
