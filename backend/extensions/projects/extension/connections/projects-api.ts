import { defineDynamic, defineOpenAPIConnection } from "eve/connections";

import extension from "../extension.js";
import { readPlatformAccessToken } from "../lib/platform-access-token.js";
import { projectsOpenApiSpec } from "../lib/projects-openapi.js";

type ConnectionEventContext = {
  session: {
    id: string;
    auth: {
      current?: { principalType?: string; principalId?: string } | null;
    };
  };
};

function projectsApiConnections(ctx: ConnectionEventContext) {
  const { apiBaseUrl, agentId } = extension.config;
  const connections: Record<
    string,
    ReturnType<typeof defineOpenAPIConnection>
  > = {};

  if (!apiBaseUrl) {
    return connections;
  }

  const caller = ctx.session.auth.current;
  if (caller?.principalType !== "user" || !caller.principalId) {
    return connections;
  }

  connections["projects-api"] = defineOpenAPIConnection({
    spec: projectsOpenApiSpec,
    baseUrl: apiBaseUrl,
    description:
      "Platform projects API — create and maintain agent-scoped project instructions; bind the active chat to a project.",
    instanceKey: caller.principalId,
    auth: (callCtx) => ({
      credentialOwner: "user",
      getToken: async () => {
        const token = readPlatformAccessToken(callCtx);
        if (!token) {
          throw new Error(
            "An authenticated user session with a platform JWT is required to manage projects.",
          );
        }
        return { token };
      },
    }),
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
}

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => projectsApiConnections(ctx),
    // Re-resolve per turn so restored sessions pick up auth.current (Eve dynamic connections).
    "turn.started": (_event, ctx) => projectsApiConnections(ctx),
  },
});
