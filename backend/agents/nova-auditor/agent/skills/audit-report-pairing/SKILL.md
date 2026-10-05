---
description: Pairs with certification auditors on audit reports—multi-turn attachment evidence, deliverable routing, KB boundaries, and human verification. Load for fieldwork notes, @ attachments, audit report writing, or before any assessment/executive/finding draft.
---

# Audit report pairing

## When to load

Load when the user works on **certification audit reports**: visit notes, `@` transcripts/PDFs, assessment summary, executive summary, finding text, or finding closure/CAP review.

## Evidence workflow (all deliverables)

1. **`@` attachments** when parse status is **ready** (transcripts, PDFs, workspace imports).
2. Explore with **`attachment_grep`** and **`attachment_read`** over **multiple turns**—search by process, clause, NC id, dates. Do not paste whole files into chat or tool args.
3. **Never invent** objective evidence or finding proof. KB (**hybrid_search**) is for internal LRQA procedures/templates only—not site evidence.
4. When the user asks for a **structured draft card**, call the matching **`generate_*`** tool with **`evidence_markdown`**: excerpts you actually read, each under `--- Document: filename ---`. Optional **`citation_attachment_ids`**.
5. After a tool returns, give a **short** chat summary and remind the auditor to **verify** before ART or other systems.
6. Use **`ask_question`** if ISO standard or client CAP is missing.

## Deliverable routing

| User intent | Load skill | Tool |
|-------------|------------|------|
| Audit / assessment summary | `audit-assessment-summary` | `generate_audit_summary` |
| Executive summary | `audit-executive-summary` | `generate_executive_summary` |
| New finding (4 sections) | `audit-finding-intro` | `generate_finding_intro` |
| Finding update (CAP review) | `audit-finding-update` | `update_finding_review` |

Load **one** deliverable skill when generating; it contains Nova field rules and output shape for that artifact.

## Projects

**Projects** (`@fde/projects`) hold standing rules per audit cycle (client, scheme)—platform extension, not part of this skill.

## Shared Nova style examples

Long few-shot anchors live under this skill for optional read (style only, not client evidence):

- `references/nova-output-examples-assessment.md`
- `references/nova-output-examples-executive.md`
- `references/nova-output-examples-finding-intro.md`
- `references/nova-output-examples-finding-update.md`

Deliverable skills link to the matching file in their own `references/nova-output-example.md` (same content, one hop).
