import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  listSchedulesForUser,
  toPublicSchedule,
} from "../../../../platform/composition/public-api.js";
import { requireScheduleOwner } from "../lib/schedule-owner.js";

export default defineTool({
  description: "List the current user's scheduled agent tasks and their status.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { userId } = requireScheduleOwner(ctx);
    const tasks = await listSchedulesForUser(userId);
    return tasks.map(toPublicSchedule);
  },
});
