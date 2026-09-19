import { defineChannel, DELETE, GET, OPTIONS, POST, PUT } from "eve/channels";
import { extractBearerToken, verifyJwtHmac } from "eve/channels/auth";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  findUserByEmail,
  getChatForUser,
  getDatabaseUrl,
  getJwtSecret,
  getUserMemorySnapshot,
  listAgents,
  listChats,
  loadModelSettings,
  loginWithPassword,
  MODEL_PRESETS,
  resolveCorsOrigin,
  saveModelSettings,
  softDeleteChat,
  toPublicSettings,
  type ModelSettingsUpdate,
} from "../../../../platform/composition/public-api";

function corsHeaders(request?: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(
      request?.headers.get("origin") ?? null,
    ),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request): Response {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

function preflight(path: string) {
  return OPTIONS(path, async (request) =>
    new Response(null, { status: 204, headers: corsHeaders(request) }),
  );
}

async function requireUser(request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const result = await verifyJwtHmac(token, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audiences: [JWT_AUDIENCE],
    secret: getJwtSecret(),
  });
  if (!result.ok) return null;
  return result.sessionAuth;
}

function toChatSummary(chat: {
  id: string;
  agentId: string;
  eveSessionId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: chat.id,
    agentId: chat.agentId,
    eveSessionId: chat.eveSessionId,
    title: chat.title ?? "New chat",
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

export default defineChannel({
  routes: [
    preflight("/api/auth/login"),
    preflight("/api/auth/me"),
    preflight("/api/agents"),
    preflight("/api/chats"),
    preflight("/api/chats/:id"),
    preflight("/api/settings/model"),
    preflight("/api/settings/model/presets"),
    preflight("/api/memory"),

    POST("/api/auth/login", async (request) => {
      let body: { email?: string; password?: string };
      try {
        body = (await request.json()) as { email?: string; password?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      const email = body.email?.trim() ?? "";
      const password = body.password ?? "";
      if (!email || !password) {
        return json(
          { ok: false, error: "Email and password are required" },
          400,
          request,
        );
      }

      const result = await loginWithPassword(email, password);
      if ("error" in result) {
        return json({ ok: false, error: result.error }, 401, request);
      }

      return json(
        { ok: true, token: result.token, user: result.user },
        200,
        request,
      );
    }),
    GET("/api/auth/me", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const user = findUserByEmail(auth.principalId);
      return json(
        {
          ok: true,
          user: {
            email: auth.principalId,
            displayName: user?.displayName ?? auth.principalId,
          },
        },
        200,
        request,
      );
    }),
    GET("/api/agents", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, agents: listAgents() }, 200, request);
    }),

    GET("/api/chats", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      const agentId = new URL(request.url).searchParams.get("agentId")?.trim();
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      try {
        const rows = await listChats({
          userId: auth.principalId,
          agentId,
        });
        return json(
          { ok: true, chats: rows.map(toChatSummary) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to list chats",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/chats/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      const chatId = params.id;
      try {
        const chat = await getChatForUser({
          userId: auth.principalId,
          chatId,
        });
        if (!chat) {
          return json({ ok: false, error: "Chat not found" }, 404, request);
        }
        return json(
          {
            ok: true,
            chat: {
              ...toChatSummary(chat),
              events: chat.events.map((event) => event.payload),
            },
          },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to load chat",
          },
          500,
          request,
        );
      }
    }),

    DELETE("/api/chats/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      const chatId = params.id;
      try {
        const deleted = await softDeleteChat({
          userId: auth.principalId,
          chatId,
        });
        if (!deleted) {
          return json({ ok: false, error: "Chat not found" }, 404, request);
        }
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to delete chat",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/memory", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId")?.trim() || "omni";

      try {
        const memory = await getUserMemorySnapshot({
          userEmail: auth.principalId,
          agentId,
        });
        return json({ ok: true, memory }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to load memory",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/settings/model/presets", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, presets: MODEL_PRESETS }, 200, request);
    }),

    GET("/api/settings/model", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const settings = await loadModelSettings();
      return json(
        {
          ok: true,
          settings: toPublicSettings(settings),
        },
        200,
        request,
      );
    }),

    PUT("/api/settings/model", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      let body: ModelSettingsUpdate;
      try {
        body = (await request.json()) as ModelSettingsUpdate;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      try {
        const saved = await saveModelSettings(body);
        return json(
          { ok: true, settings: toPublicSettings(saved) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to save settings",
          },
          400,
          request,
        );
      }
    }),
  ],
});
