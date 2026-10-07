import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  resolveProposalKnowledgeCredentials,
} from "#platform/application/integration/user-integration.use-case.js";
import { normalizeHttpUrl } from "#platform/infrastructure/config/mcp.config.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      try {
        const caller = ctx.session.auth.current;
        const userId =
          caller?.principalType === "user" ? caller.principalId : null;

        const { catalogUrl: rawCatalog, cvUrl: rawCv, apiKey } =
          await resolveProposalKnowledgeCredentials(userId);
        const catalogUrl = rawCatalog ? normalizeHttpUrl(rawCatalog) : null;
        const cvUrl = rawCv ? normalizeHttpUrl(rawCv) : null;
        if (!apiKey) return null;

        const out: Record<string, ReturnType<typeof defineMcpClientConnection>> =
          {};

        if (catalogUrl) {
          out["proposal-catalog"] = defineMcpClientConnection({
            url: catalogUrl,
            description:
              "Proposal product catalog (MDM): business units, jurisdictions, SKUs, packages. Prefer dual-path recall_catalog when listed; drill-down with get_product / expand_package.",
            instanceKey: userId ?? "proposal-catalog",
            auth: {
              credentialOwner: "user",
              getToken: async () => ({ token: apiKey }),
            },
          });
        }

        if (cvUrl) {
          out["proposal-cv"] = defineMcpClientConnection({
            url: cvUrl,
            description:
              "Proposal team directory (CV): departments and people for proposal bios.",
            instanceKey: userId ?? "proposal-cv",
            auth: {
              credentialOwner: "user",
              getToken: async () => ({ token: apiKey }),
            },
          });
        }

        return Object.keys(out).length > 0 ? out : null;
      } catch (err) {
        console.warn(
          "[proposal-knowledge] session.started connection skipped:",
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    },
  },
});
