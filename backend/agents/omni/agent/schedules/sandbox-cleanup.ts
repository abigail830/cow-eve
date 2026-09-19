import { defineSchedule } from "eve/schedules";
import { sweepStaleSandboxes } from "../../../../platform/composition/public-api";

/** Dev: POST /eve/v1/dev/schedules/sandbox-cleanup */
export default defineSchedule({
  cron: "0 3 * * *",
  async run() {
    await sweepStaleSandboxes();
  },
});
