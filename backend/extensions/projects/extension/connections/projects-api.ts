import { defineDynamic, defineOpenAPIConnection } from "eve/connections";

import extension from "../extension.js";
import { readPlatformAccessToken } from "../lib/platform-access-token.js";
import { projectsOpenApiSpec } from "../lib/projects-openapi.js";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const { apiBaseUrl, agentId } = extension.config;
      const connections: Record<
        string,
        ReturnType<typeof defineOpenAPIConnection>
      > = {};

      if (!apiBaseUrl) {
        return connections;
      }

      const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
      if (!auth || auth.principalType !== "user") {
        return connections;
      }

      connections["projects-api"] = defineOpenAPIConnection({
        spec: projectsOpenApiSpec,
        baseUrl: apiBaseUrl,
        description:
          "Platform projects API — create and maintain agent-scoped project instructions; bind the active chat to a project.",
        instanceKey: auth.principalId,
        auth: {
          credentialOwner: "user",
          getToken: async () => {
            const token = readPlatformAccessToken(ctx);
            if (!token) {
              throw new Error(
                "An authenticated user session with a platform JWT is required to manage projects.",
              );
            }
            return { token };
          },
        },
        toolCall: {
          providedArguments: {
            agentId,
            eveSessionId: (callCtx) => callCtx.session.id,
          },
        },
        operations: {
          allow: [
            "listProjects",
            "createProject",
            "getProject",
            "updateProject",
            "deleteProject",
            "bindChatSession",
          ],
        },
      });

      return connections;
    },
  },
});
