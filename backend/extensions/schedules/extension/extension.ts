import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    apiBaseUrl: z.string().url().optional(),
  }),
});
