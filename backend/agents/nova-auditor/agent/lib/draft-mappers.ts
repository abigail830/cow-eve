import type { AuditSummaryModel, ExecutiveSummaryModel, FindingIntroModel, FindingUpdateModel } from "./generation-schemas.js";
import { buildEnvelope, type StructuredDraftSection } from "./structured-draft.js";

function sectionBody(value: string | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

function missingFlags(value: string | undefined): StructuredDraftSection["flags"] {
  return value?.trim() ? undefined : ["verify"];
}

export function auditSummaryToEnvelope(
  data: Partial<AuditSummaryModel>,
  status: "ok" | "degraded" = "ok",
) {
  const sections: StructuredDraftSection[] = [
    {
      id: "audit_subject",
      label: "Audit subject",
      body: sectionBody(data.audit_subject),
      flags: missingFlags(data.audit_subject),
    },
    {
      id: "auditor",
      label: "Auditor",
      body: sectionBody(data.auditor),
      artExclude: true,
      flags: missingFlags(data.auditor),
    },
    {
      id: "auditees",
      label: "Auditee(s)",
      body: sectionBody(data.auditees),
      artExclude: true,
      flags: missingFlags(data.auditees),
    },
    {
      id: "objective_evidence",
      label: "Objective evidence, process controls reviewed and comments",
      body: sectionBody(data.objective_evidence_process_controls_reviewed_and_comments),
      flags: missingFlags(data.objective_evidence_process_controls_reviewed_and_comments),
    },
  ];
  const artPayload =
    data.audit_subject?.trim() && data.objective_evidence_process_controls_reviewed_and_comments?.trim()
      ? {
          XXLR_ART_ASSESSMENT_SUMMARY: {
            audit_of: data.audit_subject,
            objective_evidence: data.objective_evidence_process_controls_reviewed_and_comments,
          },
        }
      : undefined;
  return buildEnvelope({
    templateId: "audit.summary",
    title: "Audit Summary",
    status,
    sections,
    artPayload,
  });
}

export function executiveSummaryToEnvelope(
  data: Partial<ExecutiveSummaryModel>,
  status: "ok" | "degraded" = "ok",
) {
  const sections: StructuredDraftSection[] = [
    {
      id: "audit_outcome",
      label: "Audit outcome",
      body: sectionBody(data.audit_outcome),
      flags: missingFlags(data.audit_outcome),
    },
    {
      id: "continual_improvement",
      label: "Continual improvement",
      body: sectionBody(data.continual_improvement),
      flags: missingFlags(data.continual_improvement),
    },
    {
      id: "areas_for_senior_management_attention",
      label: "Areas for senior management attention",
      body: sectionBody(data.areas_for_senior_management_attention),
      flags: missingFlags(data.areas_for_senior_management_attention),
    },
  ];
  const artPayload =
    data.audit_outcome?.trim() &&
    data.continual_improvement?.trim() &&
    data.areas_for_senior_management_attention?.trim()
      ? {
          XXLR_ART_EXECUTIVE_SUMMARY: {
            audit_outcome: data.audit_outcome,
            continual_improvement: data.continual_improvement,
            areas_for_attention: data.areas_for_senior_management_attention,
          },
        }
      : undefined;
  return buildEnvelope({
    templateId: "audit.executive_summary",
    title: "Executive Summary",
    status,
    sections,
    artPayload,
  });
}

export function findingIntroToEnvelope(
  data: Partial<FindingIntroModel>,
  meta?: { standard?: string; grade?: string },
  status: "ok" | "degraded" = "ok",
) {
  const sections: StructuredDraftSection[] = [
    {
      id: "clause",
      label: "Clause",
      body: sectionBody(data.clause),
      flags: missingFlags(data.clause),
    },
    {
      id: "statement_of_non_conformity",
      label: "Statement of Non-Conformity",
      body: sectionBody(data.statement_of_non_conformity),
      flags: missingFlags(data.statement_of_non_conformity),
    },
    {
      id: "requirement",
      label: "Requirement",
      body: sectionBody(data.requirement),
      flags: missingFlags(data.requirement),
    },
    {
      id: "evidence_of_non_conformity",
      label: "Evidence of Non-Conformity",
      body: sectionBody(data.evidence_of_non_conformity),
      flags: missingFlags(data.evidence_of_non_conformity),
    },
  ];
  return buildEnvelope({
    templateId: "audit.finding_intro",
    title: "Finding (introduction)",
    status,
    sections,
    meta,
  });
}

export function findingUpdateToEnvelope(
  data: Partial<FindingUpdateModel>,
  clientPlanSummary: string | null,
  status: "ok" | "degraded" = "ok",
) {
  const sections: StructuredDraftSection[] = [];
  if (clientPlanSummary) {
    sections.push({
      id: "client_plan",
      label: "Correction, Corrective Action and Timescale proposed by the client",
      body: clientPlanSummary,
    });
  }
  sections.push(
    {
      id: "correction_review",
      label: "Correction Review",
      body: sectionBody(data.correction_review),
      flags: missingFlags(data.correction_review),
    },
    {
      id: "root_cause_review",
      label: "Root Cause Review",
      body: sectionBody(data.root_cause_review),
      flags: missingFlags(data.root_cause_review),
    },
    {
      id: "corrective_action_review",
      label: "Corrective Action Review",
      body: sectionBody(data.corrective_action_review),
      flags: missingFlags(data.corrective_action_review),
    },
  );
  return buildEnvelope({
    templateId: "audit.finding_update",
    title: "Finding update",
    status,
    sections,
  });
}
