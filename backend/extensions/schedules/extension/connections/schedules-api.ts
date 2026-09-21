import { defineDynamic, defineOpenAPIConnection } from "eve/connections";

import extension from "../extension.js";
import { readPlatformAccessToken } from "../lib/platform-access-token.js";
import { schedulesOpenApiSpec } from "../lib/schedules-openapi.js";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const { apiBaseUrl } = extension.config;
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

      connections["schedules-api"] = defineOpenAPIConnection({
        spec: schedulesOpenApiSpec,
        baseUrl: apiBaseUrl,
        description:
          "Platform schedule API — create, list, update, and delete scheduled agent runs.",
        instanceKey: auth.principalId,
        auth: {
          credentialOwner: "user",
          getToken: async () => {
            const token = readPlatformAccessToken(ctx);
            if (!token) {
              throw new Error(
                "An authenticated user session with a platform JWT is required to manage schedules.",
              );
            }
            return { token };
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
    },
  },
});
