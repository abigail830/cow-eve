import { z } from "zod";

export const auditSummaryModelSchema = z.object({
  audit_subject: z.string(),
  auditor: z.string(),
  auditees: z.string(),
  objective_evidence_process_controls_reviewed_and_comments: z.string(),
});

export const executiveSummaryModelSchema = z.object({
  audit_outcome: z.string(),
  continual_improvement: z.string(),
  areas_for_senior_management_attention: z.string(),
});

export const findingIntroModelSchema = z.object({
  clause: z.string(),
  statement_of_non_conformity: z.string(),
  requirement: z.string(),
  evidence_of_non_conformity: z.string(),
});

export const clientPlanExtractSchema = z.object({
  present: z.boolean(),
  summary: z.string().optional(),
});

export const findingUpdateModelSchema = z.object({
  correction_review: z.string(),
  root_cause_review: z.string(),
  corrective_action_review: z.string(),
});

export type AuditSummaryModel = z.infer<typeof auditSummaryModelSchema>;
export type ExecutiveSummaryModel = z.infer<typeof executiveSummaryModelSchema>;
export type FindingIntroModel = z.infer<typeof findingIntroModelSchema>;
export type FindingUpdateModel = z.infer<typeof findingUpdateModelSchema>;
