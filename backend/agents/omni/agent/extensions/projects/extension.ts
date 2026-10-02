import projects from "@fde/projects";
import { resolvePlatformApiBaseUrl } from "../../lib/platform-api-base-url.js";

export default projects({
  apiBaseUrl: resolvePlatformApiBaseUrl(),
  agentId: "omni",
});
