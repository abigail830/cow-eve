/** Inline OpenAPI contract for platform schedule REST routes (/api/schedules). */
export const schedulesOpenApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FDE Desk Schedule API",
    version: "1.0.0",
    description:
      "Create, list, update, and delete scheduled agent runs for the authenticated user.",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      CreateScheduleRequest: {
        type: "object",
        required: ["prompt", "firstRunAt"],
        properties: {
          name: { type: "string", maxLength: 200 },
          prompt: { type: "string", minLength: 1, maxLength: 8000 },
          firstRunAt: { type: "string", format: "date-time" },
          everyMinutes: { type: "integer", nullable: true, minimum: 1, maximum: 525600 },
          timezone: { type: "string", minLength: 1, maxLength: 64, default: "Asia/Shanghai" },
        },
      },
      UpdateScheduleRequest: {
        type: "object",
        properties: {
          name: { type: "string", nullable: true, maxLength: 200 },
          prompt: { type: "string", minLength: 1, maxLength: 8000 },
          nextRunAt: { type: "string", format: "date-time" },
          everyMinutes: { type: "integer", nullable: true, minimum: 1, maximum: 525600 },
          enabled: { type: "boolean" },
          timezone: { type: "string", minLength: 1, maxLength: 64 },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/schedules": {
      get: {
        operationId: "listSchedules",
        summary: "List the current user's scheduled agent tasks.",
        responses: {
          "200": { description: "Schedule list" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        operationId: "createSchedule",
        summary: "Create a one-time or repeating scheduled agent run.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateScheduleRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Schedule created" },
          "400": { description: "Invalid input" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/schedules/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      get: {
        operationId: "getSchedule",
        summary: "Load one scheduled task by id.",
        responses: {
          "200": { description: "Schedule found" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
      put: {
        operationId: "updateSchedule",
        summary: "Update, pause, or resume a scheduled agent task.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateScheduleRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Schedule updated" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
      delete: {
        operationId: "deleteSchedule",
        summary: "Permanently delete a scheduled agent task.",
        responses: {
          "200": { description: "Schedule deleted" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
    },
  },
} as const;
