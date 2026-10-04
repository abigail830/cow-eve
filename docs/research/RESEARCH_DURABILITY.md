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
| **`research_retrieve`** | Workflow: delegate to `retrieve` subagent, merge into session state |
| **`sync_research_ledger`** | Flush state → `evidence.jsonl` + `progress.md` |
| **`publish`** | Requires plan + evidence (state or jsonl) |

Parent agent **must not** use root MCP connections. MCP runs only on the **`retrieve`** subagent (`tool: false` on the subagent; callable via workflow).

## Budgets (per user message / turn)

- **`research_retrieve` calls:** ≤ 6  
- **Web MCP calls (turn total):** ≤ 8  
- **Per retrieve:** ≤ 2 web, ≤ 1 KB  
- **Parallel retrieve:** ≤ 2 (use `task_wait`, then `sync_research_ledger`)

## Vercel / Eve Workflow

- Each model step is checkpointed; keep **`modelCallsPerStep` at default 1** on parent and retrieve.
- Heavy MCP work runs in the **child session**; parent steps are orchestration + ledger sync.
- **`research_retrieve` uses `execute`** (turn waits). A **new user message** in the same chat can abort an in-flight workflow (steering)—see [ASYNC_AND_CHAT.md](./ASYNC_AND_CHAT.md).
- Step replay dedupes findings by **`findingId`** hash in session state.

## Local dev

`npm run dev:research` (port 2002) runs from `agents/research/` with the same layout as Vercel (`EVE_INTERNAL_AGENT_WORKSPACE_MEMBER=1`). Use the same tool flow as production.

### Troubleshooting `research_retrieve` “not registered as a workflow”

Eve binds workflow tools to a **deployment id**. After you change `research_retrieve` (or related step files), **hot reload** or an old dev host can leave in-flight turns pointing at `workflow//./agents/research/agent/tools/...` while the server registers `workflow//./agent/tools/...`.

**Fix:** `./scripts/restart.sh research` (clears workflow run data + dev hosts), then **start a new chat** and rerun the research prompt. Do not fall back to parent-level `connection_search` / MCP — that bypasses the ledger.

Mid-deploy on Vercel: same symptom until the new deployment is live; retry in a **new chat** after deploy finishes.

## Smoke checklist

1. Plan in chat → **`init_research_files`** → `plan.md` exists.  
2. **`research_retrieve`** → short tool result; **`sync_research_ledger`** → `evidence.jsonl` non-empty.  
3. **`publish`** without evidence fails with a clear error.  
4. Vercel: parent stream should not show long parent-level MCP `connection_execute` chains.
