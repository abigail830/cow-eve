import { defineDynamic, defineOpenAPIConnection } from "eve/connections";

import extension from "../extension.js";
import { readPlatformAccessToken } from "../lib/platform-access-token.js";
import { schedulesOpenApiSpec } from "../lib/schedules-openapi.js";

type ConnectionEventContext = {
  session: {
    auth: {
      current?: { principalType?: string; principalId?: string } | null;
    };
  };
};

function schedulesApiConnections(ctx: ConnectionEventContext) {
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

  connections["schedules-api"] = defineOpenAPIConnection({
    spec: schedulesOpenApiSpec,
    baseUrl: apiBaseUrl,
    description:
      "Platform schedule API — create, list, update, and delete scheduled agent runs for this agent only.",
    instanceKey: caller.principalId,
    auth: (callCtx) => ({
      credentialOwner: "user",
      getToken: async () => {
        const token = readPlatformAccessToken(callCtx);
        if (!token) {
          throw new Error(
            "An authenticated user session with a platform JWT is required to manage schedules.",
          );
        }
        return { token };
      },
    }),
    toolCall: {
      providedArguments: {
        agentId,
      },
    },
    operations: {
      allow: [
        "listSchedules",
        "createSchedule",
        "updateSchedule",
        "deleteSchedule",
        "getSchedule",
      ],
    },
  });

  return connections;
}

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => schedulesApiConnections(ctx),
    "turn.started": (_event, ctx) => schedulesApiConnections(ctx),
  },
});
