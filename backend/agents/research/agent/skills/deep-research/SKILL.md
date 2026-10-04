---
description: Run multi-source deep research—plan, retrieve, evidence, report—for any topic including client and sales-enablement briefs.
---

# Deep research workflow

Use this skill for investigations that need a **plan**, multiple sources, and a **published report** (not a chat-only answer).

**LRQA Account Brief or CDP:** after planning, also load **`lrqa-account-brief`** or **`lrqa-client-development-plan`** for chapter skeleton and HTML layout; this skill still owns plan → retrieve → evidence → publish.

## 1. Research plan (user-visible Markdown)

Before substantial retrieval, output:

```markdown
## Research plan

**Goal:** …
**Assumptions:** …
**Audience / use:** … (e.g. pre-meeting brief, market scan)

**Research window:** … (required when the user gives *relative* time, e.g. “recent 1–2 years” / “最近一两年”). Anchor to **today’s date** (from context or a brief date check)—**never** silently assume fixed years like 2024–2025. Write explicit **ISO dates** (start–end) and one line on how you computed the window (e.g. “rolling 24 months ending YYYY-MM-DD”).

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

Then call **`init_research_files`** with the same plan as `planMarkdown` (creates `/workspace/research/plan.md` and ledger files). **Wait for init to complete** before the first **`research_retrieve`** (never batch init and retrieve in one parallel tool block).

Do **not** call MCP search tools from the parent agent. Retrieval goes through **`research_retrieve`** only.

## 2. Retrieve

- For each sub-question, call **`research_retrieve`** with `subQuestionId`, `objective`, `allowedSources`, and a short `contextFromPlan`.
- When the job is time-bounded, repeat the **Research window** dates inside `contextFromPlan` and ask the retrieve subagent to **prioritize sources and facts within that window** (and flag anything outside it).
- **Budget (per turn):** at most **6** `research_retrieve` calls; **8** web MCP calls total across the turn (enforced in `sync_research_ledger`). Default **3** web calls per retrieve (`budget.maxWeb`); raise only when the plan justifies it.
- **Parallelism:** at most **2** overlapping retrieve tasks; use **`task_wait`** while multiple retrieves run, then **`sync_research_ledger`**.
- After each retrieve (or batch), call **`sync_research_ledger`** so `evidence.jsonl` and `progress.md` match session state.

Simple topics: 1–2 retrieves. Complex LRQA-style briefs: up to the budgets above.

## 3. Reflect

If important sub-questions remain open after a reasonable pass, do **one** targeted follow-up **`research_retrieve`** round—then stop. Note remaining gaps in the report.

## 4. Write & publish

- Call **`sync_research_ledger`**, then read **`/workspace/research/evidence.jsonl`** and **`plan.md`** (segment reads; do not paste the full ledger into chat).
- Write the full report to `/workspace/research/report.md` (or a descriptive `.md` / `.html` name).
- Include sections appropriate to the topic; for client/sales contexts, favor: **Quick take**, **Context**, **What matters for the conversation**, **Risks / guardrails**, **Questions to ask**, **Sources & confidence**.
- Call **`publish`** with the sandbox path. Keep the chat reply to a concise summary and point to the download card.

## 5. Cost discipline (soft)

- Prefer fewer, sharper queries over exhaustive scraping.
- Stop when the outline is adequately supported or further search has diminishing returns.

## After context compaction

Re-read **`/workspace/research/plan.md`** and **`progress.md`** (via read_file), call **`sync_research_ledger`** if needed, then continue the same research—do not restart from scratch.
