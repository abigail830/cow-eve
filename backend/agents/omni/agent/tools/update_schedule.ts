import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  toPublicSchedule,
  updateScheduleForUser,
} from "#platform/composition/public-api.js";
import { requireScheduleOwner } from "../lib/schedule-owner";

export default defineTool({
  description:
    "Update, pause, or resume one of the current user's scheduled agent tasks.",
  inputSchema: z.object({
    id: z.string().uuid(),
    name: z.string().max(200).optional(),
    prompt: z.string().min(1).max(8000).optional(),
    nextRunAt: z.string().datetime({ offset: true }).optional(),
    everyMinutes: z.number().int().min(1).max(525600).nullable().optional(),
    enabled: z.boolean().optional(),
    timezone: z.string().min(1).max(64).optional(),
  }),
  async execute({ id, nextRunAt, ...patch }, ctx) {
    const { userId } = requireScheduleOwner(ctx);
    const task = await updateScheduleForUser(userId, id, {
      ...patch,
      ...(nextRunAt ? { nextRunAt: new Date(nextRunAt) } : {}),
    });
    if (!task) {
      throw new Error("Schedule not found.");
    }
    return toPublicSchedule(task);
  },
});
