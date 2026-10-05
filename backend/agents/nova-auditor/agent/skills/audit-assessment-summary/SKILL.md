---
description: Drafts certification audit assessment summaries (audit subject, auditor, auditees, objective evidence) from read attachment evidence. Load when the user asks for audit summary, assessment summary, or visit summary for an audit report.
---

# Assessment summary

## When to load

User asks for **audit summary**, **assessment summary**, or equivalent visit summary for the audit report.

## Evidence → tool

1. `@` visit materials; **`attachment_grep` / `attachment_read`** until scope, auditees, sampled processes, and objective evidence themes are supported by excerpts.
2. Call **`generate_audit_summary`** with **`evidence_markdown`** (excerpts + filenames only).
3. Optional tool args: **`length`**, **`complexity`**, **`focus_areas`** (see below). Defaults: `moderate`, `balanced`.

## Nova form (must match semantics)

Fill summarising **transcription + auditor notes** (your evidence pack). Use these **exact field meanings**:

| JSON key | Header / content |
|----------|------------------|
| `audit_subject` | **Audit subject** — area or theme audited |
| `auditor` | **Auditor** name(s) |
| `auditees` | **Auditee(s)** — names/roles; bullets OK |
| `objective_evidence_process_controls_reviewed_and_comments` | **Objective evidence, process controls reviewed and comments** — include scope, website/context where relevant, processes/procedures reviewed, comments, **evaluation and conclusions** from the sample |

Title culture: **Audit Summary**.

**Language:** Output language must match **evidence language**, unless the user specifies another output language.

## Length and complexity (Nova `summary_controls`)

| `length` | Instruction |
|----------|-------------|
| `brief` | Keep the response short and direct. Use the fewest words needed while still answering each section clearly. |
| `moderate` | Provide a balanced response with enough context to be useful, but avoid unnecessary repetition. |
| `detailed` | Provide a fuller response with supporting context, nuance, and clear reasoning where relevant. |

| `complexity` | Instruction |
|--------------|-------------|
| `simple` | Use straightforward language and a clear, plain structure. |
| `balanced` | Use a balanced level of detail and reasoning, with moderate nuance. |
| `deep` | Use more analytical language, connect related points, and explain implications where helpful. |

**`focus_areas` (optional):** Prioritise the user-named topics in the objective-evidence section.

## JSON output (tool normalizes to draft card)

Model must return **only** valid JSON with keys:

`audit_subject`, `auditor`, `auditees`, `objective_evidence_process_controls_reviewed_and_comments`

Double quotes; no markdown fences in model output.

## After generation

Remind the auditor: **Auditor** and **Auditee(s)** display on the draft but may not map to all downstream systems—verify before submit.

## Style few-shot

Before calling the tool, read **`references/nova-output-example.md`** for Nova depth/structure (Petersen Stainless example—**style anchor only**, not evidence for the current client).
