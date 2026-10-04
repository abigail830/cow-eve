---
description: LRQA Client Development Plan (CDP)—engagement, expansion map, product codes, plays and actions, guardrails. Load when the user asks for a CDP, client development plan, expansion map, or account growth plan for an existing LRQA relationship.
---

# LRQA client development plan (CDP)

Use with **`deep-research`**. CDP = **relationship execution** on top of account understanding—not a duplicate account brief.

## When to load

- User or Project says **CDP**, **client development plan**, **expansion map**, **30-day plan**, or **solution-line** selling for a named account.
- Prefer also loading **`lrqa-account-brief`** only when the user needs **both** documents in one job; otherwise CDP alone.

## Deliverable

- **Single-file LRQA HTML** at `/workspace/research/cdp-<slug>.html` using **`../lrqa-account-brief/references/html-account-report.md`** (CDP nav + expansion map components).
- **`publish`** when done.

## Nine chapters (CDP)

| # | EN | Part |
|---|-----|------|
| — | Overview (hero) | — |
| 1 | The plan in one line | Position |
| 2 | Current engagement | Position |
| 3 | Client profile | Position |
| 4 | Expansion map | Position |
| 5 | Context and synthesis | Judgement |
| 6 | Expansion thesis | Judgement |
| 7 | Plays and questions | Action |
| 8 | Execution and review | Action |
| 9 | Guardrails and provenance | Reference |

Include a short **Brief vs CDP** table in §1 (what each document answers).

## Data rules

- **HubSpot + workspace + KB** for current engagement, contacts, and catalog/methodology when available.
- **Web** for market/regulatory context and timeliness.
- **Omit** blocks that require CRM fields you do not have (e.g. signal bar C-1, health strip C-5): **state the omission** rather than infer renewal date, term end, contract value, or health score.
- **Framework agreement:** only claim if HubSpot or user materials support it.

## Expansion map (§4)

- Organize by **LRQA solution lines** (QA, SE, CP, RS, CY, etc.) as appropriate to the account.
- Product rows use **catalog codes** (e.g. `QA-LRQA-010`, `QA-PER-001`) **only when** KB, workspace, or HubSpot provides them—or name the offering in words and mark **TBD** / defect if the compendium handle is missing.
- **Catalog states** (use honestly): **Adopted** · **In scope, not taken up** · **Cross-sell** · **Other body** (competitor certificate, etc.).
- Depth vs breadth panels: depth = take-up inside served lines; breadth = new lines/relationships—narrative may say which panel is “funding” vs “thesis” for this account.

## Personas & actions

- Persona codes (e.g. `QA-PER-001`) only when sourced; describe role level honestly (“one level below director”).
- §7–§8: named **plays**, **questions**, and **actions** with owners/time horizon where user asked; open items stay in actions, not hidden.

## Guardrails (§9)

- Provenance flags: public **P**, internal **I**, conversation **conv** only when recorded.
- Scope discipline for sensitive industries (e.g. dual-use chemicals): stay at management-system / inspection / integrity level—no process chemistry claims.
- **Never** invent J-1 / client-success fields.

## Quality bar

- §2 and §4 only contain engagement/product facts from HubSpot, KB, workspace, or web—not inferred CRM metrics.
- Expansion map states (**Adopted**, **In scope not taken up**, etc.) match evidence; gaps appear in §8 actions or §9 provenance.
- If the user attaches a prior CDP, align **structure and honesty**, not copy-paste.
