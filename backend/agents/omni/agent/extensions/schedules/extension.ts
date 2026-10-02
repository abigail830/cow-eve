import schedules from "@fde/schedules";

const apiBaseUrl =
  process.env.PLATFORM_API_BASE_URL?.trim() ?? "http://127.0.0.1:2000";

/** Registry id for schedule dispatch and API tool injection. */
export const OMNI_PLATFORM_AGENT_ID = "omni";

export default schedules({
  apiBaseUrl,
  agentId: OMNI_PLATFORM_AGENT_ID,
});
