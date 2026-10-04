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
| **`research_retrieve`** | Workflow tool: delegate to `retrieve` subagent; flush ledger to sandbox files; **`sync_research_ledger`** hydrates parent session state from files |
| **`sync_research_ledger`** | Flush state → `evidence.jsonl` + `progress.md` |
| **`publish`** | Requires plan + evidence (state or jsonl) |

Parent agent **must not** use root MCP connections. MCP runs only on the **`retrieve`** subagent (`tool: false` on the subagent; callable via workflow).

## Budgets (per user message / turn)

- **`research_retrieve` calls:** ≤ 6  
- **Web MCP calls (turn total):** ≤ 8  
- **Per retrieve:** ≤ 2 web, ≤ 1 KB  
- **Parallel retrieve:** ≤ 2 (use `task_wait`, then `sync_research_ledger`)

## Durability notes

- Heavy MCP work runs in the **`retrieve` child session**; the parent turn waits on each **`research_retrieve`** call.
- **`research_retrieve` stays a workflow tool** because only workflows may **`await ctx.agent("retrieve")`** synchronously. **`defineState` updated in `init_research_files` does not reliably match the workflow execution context** — treat **`/workspace/research/*.md` + `evidence.jsonl`** as source of truth; **`sync_research_ledger`** rehydrates parent state from disk. [Eve #3740](https://github.com/vercel/eve/issues/3740) still requires the workflow-id patch on workspace-member builds.
- Finding dedup uses **`findingId`** hash in session state.
- A **new user message** in the same chat can abort an in-flight retrieve—see [ASYNC_AND_CHAT.md](./ASYNC_AND_CHAT.md).

## Local dev

`npm run dev:research` (port 2002) runs from `agents/research/` with the same layout as Vercel (`EVE_INTERNAL_AGENT_WORKSPACE_MEMBER=1`). Use the same tool flow as production.

### Legacy: “not registered as a workflow”

If an old chat or deploy still references **`research_retrieve` as a workflow**, you may see *not registered as a workflow* ([#3740](https://github.com/vercel/eve/issues/3740)). Current code uses a **normal tool** instead. **New chat** after deploy/restart.

`npm run patch:research-workflow-id` remains in build/dev for any stale compiled workflow ids; it is no longer required for retrieve itself.

### `Research ledger is not initialized`

Call **`init_research_files`** before **`research_retrieve`**. **`init_research_files`** marks session state before writing sandbox files; **`research_retrieve`** also treats `/workspace/research/plan.md` as a fallback marker. Do not parallelize init and retrieve in one tool batch.

### Retrieve schema errors

If the subagent reply is prose or fenced JSON, Eve `outputSchema` fails with *could not produce a result matching the requested schema*. **`research_retrieve`** parses the subagent’s final message as JSON instead; invalid replies become a **`blocked`** ledger row with a gap (turn continues). Retry with a simpler `objective` or one retrieve at a time if many `blocked` rows appear.

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
