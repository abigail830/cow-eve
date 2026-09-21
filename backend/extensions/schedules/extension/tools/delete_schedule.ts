import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { deleteScheduleForUser } from "../../../../platform/composition/public-api.js";
import { requireScheduleOwner } from "../lib/schedule-owner.js";

export default defineTool({
  description: "Permanently delete one of the current user's scheduled agent tasks.",
  inputSchema: z.object({ id: z.string().uuid() }),
  approval: always(),
  async execute({ id }, ctx) {
    const { userId } = requireScheduleOwner(ctx);
    const deleted = await deleteScheduleForUser(userId, id);
    if (!deleted) {
      throw new Error("Schedule not found.");
    }
    return { deleted: true, id };
  },
});
