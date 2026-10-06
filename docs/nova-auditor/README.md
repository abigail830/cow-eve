# Nova Auditor agent

Eve agent id: **`nova-auditor`**. Pairs with certification auditors to draft assessment summaries, executive summaries, and finding text from **auditor-provided evidence** (@ attachments, notes, transcripts).

## Dev

```bash
cd backend
npm run dev:nova-auditor
```

Default URL: `http://127.0.0.1:2003/eve/v1/*`

Run alongside omni (platform `/api/*`) and parse pipeline as for other agents.

## Email (`.eml`)

Upload `.eml` like any document: parse pipeline runs `email_standard` (MIME → markdown). Embedded attachments become separate chat/workspace files with their own parse status. `@` mentions stay disabled until each file is parse-ready. Email body is read from the parent `.eml` once it is Ready.

## Generation tools

| Tool | Purpose |
|------|---------|
| `generate_audit_summary` | Assessment summary JSON → structured draft card |
| `generate_executive_summary` | Executive summary |
| `generate_finding_intro` | New finding (four sections) |
| `update_finding_review` | Finding update (CAP review, three sections) |

**Evidence (generation):** conversation-first—agent gathers excerpts via **`attachment_read` / `attachment_grep`**, then calls a `generate_*` tool with **`evidence_markdown`**. Platform prepends the latest **composer user message** only (no automatic full-file load). Nova field rules live in **audit-* skills** (`references/nova-*.md`). UI renders **`StructuredDraftEnvelope`** via `@fde/artifact-ui`.

## Source spec

Behavior migrated from the legacy Nova Chainlit app is indexed in [../nova-system-analysis.md](../nova-system-analysis.md).
