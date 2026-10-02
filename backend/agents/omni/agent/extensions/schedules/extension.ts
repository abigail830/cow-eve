import schedules from "@fde/schedules";
import { resolvePlatformApiBaseUrl } from "../../lib/platform-api-base-url.js";

/** Registry id for schedule dispatch and API tool injection. */
export const OMNI_PLATFORM_AGENT_ID = "omni";

export default schedules({
  apiBaseUrl: resolvePlatformApiBaseUrl(),
  agentId: OMNI_PLATFORM_AGENT_ID,
});
