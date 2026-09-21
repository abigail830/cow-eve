import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z
    .object({
      hybridSearchUrl: z.string().url().optional(),
      hybridSearchApiKey: z.string().min(1).optional(),
    })
    .refine(
      (value) =>
        (!value.hybridSearchUrl && !value.hybridSearchApiKey) ||
        (Boolean(value.hybridSearchUrl) && Boolean(value.hybridSearchApiKey)),
      {
        message:
          "hybridSearchUrl and hybridSearchApiKey must both be provided or both omitted",
      },
    ),
});
