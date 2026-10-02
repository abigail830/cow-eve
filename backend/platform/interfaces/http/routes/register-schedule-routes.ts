import { DELETE, GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  createScheduleForUser,
  deleteScheduleForUser,
  getDatabaseUrl,
  listScheduleSummaryForUser,
  listSchedulesForUser,
  toPublicSchedule,
  updateScheduleForUser,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerScheduleRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/schedules"),
    preflight("/api/schedules/summary"),
    // Do not preflight `/api/schedules/:id` — GET/PUT/DELETE on same path (Eve compile).

    GET("/api/schedules/summary", async (request) => {
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
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId")?.trim();
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      const limit = Math.min(
        10,
        Math.max(1, Number(url.searchParams.get("limit") ?? "3") || 3),
      );
      try {
        const schedules = await listScheduleSummaryForUser(
          auth.principalId,
          agentId,
          limit,
        );
        return json(
          { ok: true, schedules: schedules.map(toPublicSchedule) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to list schedules",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/schedules", async (request) => {
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
      const agentId =
        new URL(request.url).searchParams.get("agentId")?.trim() || undefined;
      try {
        const schedules = await listSchedulesForUser(auth.principalId, agentId);
        return json(
          { ok: true, schedules: schedules.map(toPublicSchedule) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to list schedules",
          },
          500,
          request,
        );
      }
    }),

    POST("/api/schedules", async (request) => {
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

      let body: {
        agentId?: string;
        name?: string;
        prompt?: string;
        firstRunAt?: string;
        everyMinutes?: number | null;
        timezone?: string;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      if (!body.prompt?.trim() || !body.firstRunAt) {
        return json(
          { ok: false, error: "prompt and firstRunAt are required" },
          400,
          request,
        );
      }

      try {
        const schedule = await createScheduleForUser(auth.principalId, {
          agentId: body.agentId?.trim() || "omni",
          name: body.name,
          prompt: body.prompt,
          firstRunAt: new Date(body.firstRunAt),
          everyMinutes: body.everyMinutes ?? null,
          timezone: body.timezone,
        });
        return json(
          { ok: true, schedule: toPublicSchedule(schedule) },
          201,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to create schedule",
          },
          400,
          request,
        );
      }
    }),

    PUT("/api/schedules/:id", async (request, { params }) => {
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

      let body: {
        name?: string | null;
        prompt?: string;
        nextRunAt?: string;
        everyMinutes?: number | null;
        enabled?: boolean;
        timezone?: string;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      try {
        const { nextRunAt, ...rest } = body;
        const schedule = await updateScheduleForUser(
          auth.principalId,
          params.id,
          {
            ...rest,
            ...(nextRunAt ? { nextRunAt: new Date(nextRunAt) } : {}),
          },
        );
        if (!schedule) {
          return json({ ok: false, error: "Schedule not found" }, 404, request);
        }
        return json(
          { ok: true, schedule: toPublicSchedule(schedule) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to update schedule",
          },
          400,
          request,
        );
      }
    }),

    DELETE("/api/schedules/:id", async (request, { params }) => {
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

      try {
        const deleted = await deleteScheduleForUser(
          auth.principalId,
          params.id,
        );
        if (!deleted) {
          return json({ ok: false, error: "Schedule not found" }, 404, request);
        }
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to delete schedule",
          },
          500,
          request,
        );
      }
    }),
  ];
}
