---
description: Drafts certification executive summaries (audit outcome, continual improvement, areas for senior management attention) from attachment evidence. Load when the user asks for executive summary or management summary for an audit report.
---

# Executive summary

## When to load

User asks for **executive summary** (management summary) for the audit report.

## Evidence → tool

1. Read outcomes, NC themes, CI, and management topics via **`attachment_grep` / `attachment_read`**.
2. Call **`generate_executive_summary`** with **`evidence_markdown`**.
3. Optional tool args (Nova `summary_controls`):

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

**`focus_areas`:** Prioritise user-named topics in the executive sections.

## Nova form sections

Based on **Transcription** content (your evidence pack). Use **exact section intent**:

### Audit outcome

Overall conclusion and recommendation regarding certification. When confirming the client's management system can meet the standard and stakeholder requirements, limit to **maximum two or three sentences**, plus a clear statement on **certification status**. Conclusions must be clear for the client.

### Continual improvement

Highlight significant continual improvement activities with clear benefit. Must include a statement of **effectiveness** and whether the system delivers desired outcomes (client/regulatory requirements). Where outcomes are not achieved, summarise how and refer to related nonconformities.

### Areas for senior management attention

Very brief and concise—NC detail stays in the findings log. If no management action needed, state that. May summarise CI plans, performance against improvement objectives, and related NCs.

**Language:** Match evidence language unless the user specifies otherwise.

**Nova style:** Do **not** repeat specific evidence verbatim from the transcription; be brief; natural language.

## JSON output

Only:

`audit_outcome`, `continual_improvement`, `areas_for_senior_management_attention`

Valid JSON; double quotes.

## Style few-shot

Read **`references/nova-output-example.md`** before generating (Petersen ISO 9001 example—style only).
