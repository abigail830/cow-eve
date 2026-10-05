---
description: Drafts new audit finding introductions—clause, statement of non-conformity, requirement, evidence—from auditor notes and attachments. Load when the user asks for finding intro, finding paragraphs, or NC wording for ART.
---

# Finding introduction

## When to load

User asks to draft a **new finding**: clause, statement, requirement, evidence (four sections).

## Prerequisites

**ISO standard** required (`ISO <number>`, e.g. ISO 9001, ISO 14001)—in chat, evidence, or tool arg **`iso_standard`**. If missing, **`ask_question`**; do not assume standards not in evidence.

Optional tool arg: **`grade`** (e.g. Minor/Major).

## Evidence → tool

1. **`attachment_grep` / `attachment_read`** for **this finding only**—not the full visit dump.
2. Call **`generate_finding_intro`** with **`evidence_markdown`** and **`iso_standard`** when known.

## Nova four sections (JSON keys)

### 1. `clause`

Specific standard clause (e.g. ISO 9001:2015 clause 4.4.2) or company-system requirement not met. Concise; direct reference. **Bullet per clause** if multiple.

### 2. `statement_of_non_conformity`

Short problem sentence + brief explanation. Standard openings:

- "The \<process\> was not found to be **fully** effective." + explanation
- "The \<process\> was not found to be effective." + explanation

Must read clearly **alone**—do not rely on process-table evidence.

### 3. `requirement`

What the standard or company system expects—the "rule". Matching requirement **per clause** if multiple.

### 4. `evidence_of_non_conformity`

Clear, short, factual proof. Answer:

- What did you review?
- What was missing or incorrect?
- Where?
- How many / how often?

Polish notes professionally; stay factual. Must **justify the finding on its own**.

**Language:** Match auditor notes / evidence language.

**Important:** If notes do not state standards audited against, do not assume—ask for ISO reference.

## JSON output

Only: `clause`, `statement_of_non_conformity`, `requirement`, `evidence_of_non_conformity`. Valid JSON; concise professional wording.

## Style few-shot

Read **`references/nova-output-example.md`** for Nova clause/statement/requirement/evidence patterns (examples only).
