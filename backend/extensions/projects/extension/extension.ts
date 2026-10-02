import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    apiBaseUrl: z.string().url().optional(),
    /** Registry agent id — injected into API calls; not model-controlled. */
    agentId: z.string().min(1).default("omni"),
  }),
});
