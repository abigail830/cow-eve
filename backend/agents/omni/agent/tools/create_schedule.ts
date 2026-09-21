import { defineTool } from "eve/tools";
import { z } from "zod";
import { createScheduleForUser, toPublicSchedule } from "#platform/composition/public-api.js";
import { requireScheduleOwner } from "../lib/schedule-owner";

export default defineTool({
  description:
    "Create a one-time or repeating scheduled omni agent run for the current user.",
  inputSchema: z.object({
    prompt: z.string().min(1).max(8000),
    name: z.string().max(200).optional(),
    firstRunAt: z.string().datetime({ offset: true }),
    everyMinutes: z.number().int().min(1).max(525600).nullable().default(null),
    timezone: z.string().min(1).max(64).default("Asia/Shanghai"),
  }),
  async execute(input, ctx) {
    const { userId } = requireScheduleOwner(ctx);
    const task = await createScheduleForUser(userId, {
      name: input.name,
      prompt: input.prompt,
      firstRunAt: new Date(input.firstRunAt),
      everyMinutes: input.everyMinutes,
      timezone: input.timezone,
    });
    return toPublicSchedule(task);
  },
});
