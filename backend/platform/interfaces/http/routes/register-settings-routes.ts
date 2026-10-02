import { DELETE, GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  createUser,
  defaultModelSettings,
  deleteUser,
  listUsers,
  loadModelCatalog,
  MODEL_PRESETS,
  saveModelCatalog,
  toPublicCatalog,
  toPublicSettings,
  type ModelCatalogUpdate,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerSettingsRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/settings/model"),
    preflight("/api/settings/model/presets"),
    preflight("/api/settings/users"),
    preflight("/api/settings/users/:email"),

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
      const catalog = await loadModelCatalog();
      return json(
        {
          ok: true,
          settings: toPublicSettings(defaultModelSettings(catalog)),
          catalog: toPublicCatalog(catalog),
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

      let body: ModelCatalogUpdate;
      try {
        body = (await request.json()) as ModelCatalogUpdate;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      try {
        const saved = await saveModelCatalog(body);
        return json(
          {
            ok: true,
            settings: toPublicSettings(defaultModelSettings(saved)),
            catalog: toPublicCatalog(saved),
          },
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

    GET("/api/settings/users", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      try {
        const users = await listUsers();
        return json({ ok: true, users }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to list users",
          },
          500,
          request,
        );
      }
    }),

    POST("/api/settings/users", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      let body: { email?: string; password?: string };
      try {
        body = (await request.json()) as { email?: string; password?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      try {
        const user = await createUser({
          email: body.email ?? "",
          password: body.password ?? "",
        });
        return json({ ok: true, user }, 201, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to create user",
          },
          400,
          request,
        );
      }
    }),

    DELETE("/api/settings/users/:email", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      const email = decodeURIComponent(params.email ?? "").trim();
      if (!email) {
        return json({ ok: false, error: "Email is required" }, 400, request);
      }
      if (email.toLowerCase() === auth.principalId.toLowerCase()) {
        return json(
          { ok: false, error: "You cannot delete your own account" },
          400,
          request,
        );
      }

      try {
        await deleteUser(email);
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to delete user",
          },
          400,
          request,
        );
      }
    }),
  ];
}
