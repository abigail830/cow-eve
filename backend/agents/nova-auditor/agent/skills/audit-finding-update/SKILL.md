---
description: Drafts finding update reviews—correction, root cause, corrective action—from client CAP and auditor review notes. Load when the user updates or closes a finding with corrective action plan (CAP) evidence.
---

# Finding update

## When to load

User asks to **update/close** a finding with **correction, root cause, and corrective action** review (post-CAP).

## Prerequisites

Evidence must include the client's proposed **correction, corrective action, and timescale** (any wording). If absent, tool returns **`needs_input`**—use **`ask_question`** or have the user add CAP to notes/attachments.

## Evidence → tool

1. **`attachment_grep` / `attachment_read`** on CAP emails, forms, or notes.
2. Call **`update_finding_review`** with **`evidence_markdown`** (finding context + CAP excerpts).

## Nova three reviews (JSON keys)

Check mindset against **ISO 17021** unless stated otherwise. **Do not** put standard name, clause, or paragraph headings inside the **values**.

### `correction_review` — What was fixed immediately?

Confirm the organization eliminated the **symptom**. Look for evidence the problem was corrected (containment, replacement, updated record) and the immediate nonconforming condition is removed.

### `root_cause_review` — Why did it happen?

Assess whether the real cause was identified: documented logical RCA, appropriate method (5 Whys, fishbone, etc.), explains the NC.

### `corrective_action_review` — How will recurrence be prevented?

Verify actions eliminate the **cause**, not only the symptom: address root cause, **implemented** (not just planned), effectiveness visible. Dates, responsibilities, and effectiveness evaluation should be clear where evidence supports.

## Style constraints (Nova)

- Each value: **max 3 sentences**; tight; professional; evidence-based.
- Aim for **≤6 lines** per value; **≤5 lines** when possible.
- No filler phrases.

## Client plan (platform)

Tool runs Nova **client plan extraction** on combined evidence. If information is not present or insufficient, response is **NOT_FOUND** → user must supply CAP.

## JSON output

Only: `correction_review`, `root_cause_review`, `corrective_action_review`.

## Style few-shot

Read **`references/nova-output-example.md`** for correction/root cause/CA example phrasing.
