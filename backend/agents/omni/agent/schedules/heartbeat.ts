import { defineSchedule } from "eve/schedules";

/** Example cron: proves schedules are wired. Dev: POST /eve/v1/dev/schedules/heartbeat */
export default defineSchedule({
  cron: "0 9 * * 1",
  markdown:
    "Platform heartbeat: briefly note that haoyu-omni is healthy and list one capability reminder for maintainers (skills, memory, or remote Content Studio).",
});
