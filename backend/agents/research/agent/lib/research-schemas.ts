import { z } from "zod";

export const ResearchFindingSchema = z.object({
  claim: z.string(),
  source: z.string(),
  confidence: z.enum(["high", "med", "low"]),
});

export const RetrieveResultSchema = z.object({
  subQuestionId: z.string(),
  status: z.enum(["done", "partial", "blocked"]),
  findings: z.array(ResearchFindingSchema),
  gaps: z.array(z.string()),
  toolsUsed: z.object({
    web: z.number().int().nonnegative(),
    kb: z.number().int().nonnegative(),
    hubspot: z.number().int().nonnegative(),
  }),
});

export type RetrieveResult = z.infer<typeof RetrieveResultSchema>;
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;

export const MAX_RETRIEVE_CALLS_PER_TURN = 6;
export const MAX_WEB_CALLS_PER_TURN = 8;
export const MAX_PARALLEL_RETRIEVE = 2;
export const MAX_WEB_PER_RETRIEVE = 2;
export const MAX_KB_PER_RETRIEVE = 1;
