import { defineSchedule } from "eve/schedules";
import eve from "../channels/eve";
import {
  claimDueSchedules,
  completeSchedule,
  mintScheduledRunAuth,
  releaseSchedule,
} from "#platform/composition/public-api.js";

/** Dev: POST /eve/v1/dev/schedules/dynamic */
export default defineSchedule({
  cron: "* * * * *",
  run({ to, waitUntil }) {
    waitUntil(
      (async () => {
        const jobs = await claimDueSchedules({
          limit: 25,
          leaseForMs: 5 * 60_000,
        });

        await Promise.all(
          jobs.map(async (job) => {
            try {
              const auth = mintScheduledRunAuth(job.userId, {
                scheduleId: job.id,
              });
              await to(eve, {}).send(
                [`[Scheduled run ${job.id}]`, job.prompt].join("\n\n"),
                { auth },
              );
              await completeSchedule(job);
              console.info("[schedule-dispatch] completed", {
                scheduleId: job.id,
                userId: job.userId,
              });
            } catch (error) {
              console.error("[schedule-dispatch] failed", {
                scheduleId: job.id,
                userId: job.userId,
                error: error instanceof Error ? error.message : error,
              });
              await releaseSchedule(job, {
                error,
                retryAt: new Date(Date.now() + 5 * 60_000),
              });
            }
          }),
        );
      })(),
    );
  },
});
