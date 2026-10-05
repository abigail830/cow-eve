/** Inline OpenAPI contract for platform project REST routes (/api/projects). */
export const projectsOpenApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FDE Desk Projects API",
    version: "1.0.0",
    description:
      "Create, list, update, and delete agent-scoped projects and bind chats to project instructions.",
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
      CreateProjectRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          instructions: { type: "string", maxLength: 32_000 },
        },
      },
      UpdateProjectRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          instructions: { type: "string", maxLength: 32_000 },
        },
      },
      BindChatSessionRequest: {
        type: "object",
        properties: {
          projectId: { type: "string", format: "uuid", nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/projects": {
      get: {
        operationId: "listProjects",
        summary: "List projects for the current agent.",
        parameters: [
          {
            name: "agentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Project list" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        operationId: "createProject",
        summary: "Create a project with optional standing instructions.",
        parameters: [
          {
            name: "agentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateProjectRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Project created" },
          "400": { description: "Invalid input" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/projects/detail/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "agentId",
          in: "query",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        operationId: "getProject",
        summary: "Load one project by id.",
        responses: {
          "200": { description: "Project found" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
      put: {
        operationId: "updateProject",
        summary: "Update project name and/or standing instructions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateProjectRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Project updated" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
      delete: {
        operationId: "deleteProject",
        summary: "Soft-delete a project.",
        responses: {
          "200": { description: "Project deleted" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/chat-sessions/bind": {
      post: {
        operationId: "bindChatSession",
        summary:
          "Bind the current chat session to a project so its instructions apply on every turn.",
        parameters: [
          {
            name: "agentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "eveSessionId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BindChatSessionRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Session bound" },
          "400": { description: "Invalid input" },
          "401": { description: "Unauthorized" },
        },
      },
    },
  },
} as const;
