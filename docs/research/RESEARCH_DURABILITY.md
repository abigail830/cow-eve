# Ann Researcher — durable deep research

Long investigations use a **parent orchestrator** plus a **`retrieve` subagent** so MCP payloads stay out of the parent chat history.

## Ledger files (parent sandbox)

| Path | Purpose |
|------|---------|
| `/workspace/research/plan.md` | Authoritative agenda |
| `/workspace/research/progress.md` | Per sub-question status and tool counts |
| `/workspace/research/evidence.jsonl` | One JSON object per finding (append-only) |

Artifacts nav lists only **`publish`** outputs, not these files.

## Tools

| Tool | Role |
|------|------|
| **`init_research_files`** | Write `plan.md` and initialize ledger after the chat plan |
| **`research_retrieve`** | Workflow tool: delegate to `retrieve` subagent; **append** findings to sandbox after the budget step (not inside `"use step"` — sandbox is unavailable there) |
| **`sync_research_ledger`** | Hydrate parent session state **from** sandbox files, then rewrite files from state |
| **`publish`** | Requires plan + evidence (state or jsonl) |

Parent agent **must not** use root MCP connections. MCP runs only on the **`retrieve`** subagent (`tool: false` on the subagent; callable via workflow).

**Web, KB (hybrid-search), HubSpot, and workspace** all use the same **`research_retrieve`** → **`retrieve`** path. There is no separate “HubSpot retrieve tool”; if you see *not registered as a workflow*, every source fails until workflow registration / session is fixed—not just web search.

**HubSpot vs web/KB on the retrieve subagent:** Zhipu and hybrid-search use **API keys** (env or Integrations) and mount on `session.started` without a platform `agentId`. HubSpot uses **OAuth scoped to the sidebar agent** (`research`). The retrieve child session often has **no chat row** for its Eve session id, so OAuth lookup used to fail silently and the subagent only saw web+KB. **`subagents/retrieve/connections/hubspot.ts`** now falls back to platform agent id **`research`** when chat lookup misses (same Integrations card you use on Ann Researcher).

**HubSpot MCP URL:** Use **`https://mcp.hubspot.com`** (Streamable HTTP root). The old default **`…/mcp`** could yield *MCP SSE Transport Error: 404* during client init. If `HUBSPOT_MCP_URL` is set in env, drop the trailing `/mcp` unless HubSpot docs for your app say otherwise.

## Budgets (per user message / turn)

- **`research_retrieve` calls:** ≤ 6  
- **Web MCP calls (turn total):** ≤ 8  
- **Per retrieve:** ≤ 2 web, ≤ 1 KB  
- **Parallel retrieve:** ≤ 2 (use `task_wait`, then `sync_research_ledger`)

## Durability notes

- Heavy MCP work runs in the **`retrieve` child session**; the parent turn waits on each **`research_retrieve`** call.
- **`research_retrieve` stays a workflow tool** because only workflows may **`await ctx.agent("retrieve")`** synchronously. Parent and workflow-step **`defineState` are not shared** — without writing sandbox files, tool output could show **`findingCount` > 0** while **`evidence.jsonl` stayed empty** and **`sync_research_ledger`** returned **`evidenceLines: 0`**. The workflow step now **appends deduped rows to `evidence.jsonl`**; **`sync_research_ledger`** hydrates parent state from disk when **`plan.md`** exists. [Eve #3740](https://github.com/vercel/eve/issues/3740) still requires the workflow-id patch on workspace-member builds.
- Finding dedup uses **`findingId`** hash (session state and jsonl append).
- A **new user message** in the same chat can abort an in-flight retrieve—see [ASYNC_AND_CHAT.md](./ASYNC_AND_CHAT.md).

## Local dev

`npm run dev:research` (port 2002) runs from `agents/research/` with the same layout as Vercel (`EVE_INTERNAL_AGENT_WORKSPACE_MEMBER=1`). Use the same tool flow as production.

### “not registered as a workflow”

Two causes (often combined):

1. **Stale chat session** — Eve binds workflow tool ids when the run starts. After a **backend redeploy**, continuing the same Work chat yields *The tool was renamed or removed after this run started*. Fix: **open a new chat** with Ann Researcher and resend the task (not just refresh).
2. **Build #3740 mismatch** — workspace-member compile sometimes leaves catalog `workflowId` as `workflow//./agents/research/agent/tools/...` while registration uses `workflow//./agent/tools/...`. On **Vercel**, `vercel.ts` defines a separate **`eve-research` service build**; the patch must be appended to that service’s `buildCommand` in [backend/vercel.ts](../../vercel.ts) (not only after root `npm run build` / `config.json` inject). Until that runs on deploy, production stays broken even with a new chat.

`research_retrieve` remains a **`defineWorkflowTool`** (required for `ctx.agent("retrieve")`).

### `Research ledger is not initialized`

Call **`init_research_files`** before **`research_retrieve`**. **`init_research_files`** marks session state before writing sandbox files; **`research_retrieve`** also treats `/workspace/research/plan.md` as a fallback marker. Do not parallelize init and retrieve in one tool batch.

### Retrieve schema errors

If the subagent reply is prose or fenced JSON, Eve `outputSchema` fails with *could not produce a result matching the requested schema*. **`research_retrieve`** parses the subagent’s final message as JSON instead; invalid replies become a **`blocked`** ledger row with a gap (turn continues). Retry with a simpler `objective` or one retrieve at a time if many `blocked` rows appear.

**Confidence field:** retrieve JSON requires `confidence` **`high` | `med` | `low`**. Models often emit `"medium"` — the parser normalizes aliases (`medium` → `med`, etc.) before validation so KB findings are not dropped on first pass. Subagent instructions forbid `"medium"`.

## Smoke checklist

1. Plan in chat → **`init_research_files`** → `plan.md` exists.  
2. **`research_retrieve`** → short tool result; **`sync_research_ledger`** → `evidence.jsonl` non-empty.  
3. **`publish`** without evidence fails with a clear error.  
4. Vercel: parent stream should not show long parent-level MCP `connection_execute` chains.

### MCP probe (before a long research turn)

Retrieve MCP runs only on the **`retrieve` subagent**. If Zhipu or Hybrid Search keys/URLs are wrong, the UI can sit on **`research_retrieve` · Running…** while the stream endpoint keeps polling with no new events.

From `backend/` (uses `backend/.env`; optional `--user-id` for Integrations rows):

```bash
npm run test:research-mcp
npm run test:research-mcp -- --user-id <platform-user-uuid>
```

This checks Research `:2002` health, **`list_knowledge_bases`** on Hybrid Search MCP, and one Zhipu web search call. HubSpot is OAuth-only — connect in Settings → Integrations; not covered by this script.

### Fail-fast dev mode

Set on the **research** process (not the frontend):

```bash
RESEARCH_FAIL_FAST=1 npm run dev:research
```

| Normal | Fail-fast |
|--------|-----------|
| ≤ 6 `research_retrieve` / turn | ≤ 2 |
| ≤ 8 web MCP / turn | ≤ 2 |
| parallel retrieve ≤ 2 | ≤ 1 |

Wall-clock timeouts cannot use `AbortSignal.timeout` inside Eve workflow tools ([#3740-era runtime](https://github.com/vercel/eve/issues/3740)); fail-fast tightens **call budgets** only. Use **`npm run test:research-mcp`** to catch broken MCP before a long turn.

Use fail-fast to validate wiring; turn off for production LRQA-style runs.
