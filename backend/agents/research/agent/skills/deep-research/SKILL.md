---
description: Run multi-source deep research—plan, retrieve, evidence, report—for any topic including client and sales-enablement briefs.
---

# Deep research workflow

Use this skill for investigations that need a **plan**, multiple sources, and a **published report** (not a chat-only answer).

## 1. Research plan (user-visible Markdown)

Before substantial retrieval, output:

```markdown
## Research plan

**Goal:** …
**Assumptions:** …
**Audience / use:** … (e.g. pre-meeting brief, market scan)

### Sub-questions
1. …
2. …

### Sources (why)
- Web: …
- Workspace: … (or "none attached")
- Knowledge base: … (or "none visible / skip")
- HubSpot: … (or "not needed" / "try company match")

### Deliverable outline
- …

### Gaps & honesty
- What we may not be able to verify; CRM/internal fields we will not invent.
```

Then proceed to retrieval unless the user asked for plan-only.

## 2. Retrieve

- Call only sources justified in the plan. Parallel calls are fine when independent.
- **Web:** zhipu-web-search MCP. Prefer authoritative domains for facts; note weaker sources in evidence.
- **KB:** `list_knowledge_bases` when scope is unclear; `hybrid_search` with standalone queries. If no visible KBs, skip.
- **Workspace:** attachment read/grep/find when files exist or user @-mentioned documents.
- **HubSpot:** when CRM context helps; if search returns nothing, record "not in HubSpot"—do not fabricate deals or amounts.

Optionally append notes to `/workspace/research/evidence.md` (claim | source | confidence).

## 3. Reflect

If important sub-questions remain open after a reasonable pass, do **one** targeted follow-up retrieval round—then stop. Note remaining gaps in the report.

## 4. Write & publish

- Write the full report to `/workspace/research/report.md` (or a descriptive `.md` name).
- Include sections appropriate to the topic; for client/sales contexts, favor: **Quick take**, **Context**, **What matters for the conversation**, **Risks / guardrails**, **Questions to ask**, **Sources & confidence**.
- Call **`publish`** with the sandbox path. Keep the chat reply to a concise summary and point to the download card.

## 5. Cost discipline (soft)

- Prefer fewer, sharper queries over exhaustive scraping.
- Stop when the outline is adequately supported or further search has diminishing returns.
