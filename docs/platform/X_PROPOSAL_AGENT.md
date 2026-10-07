# X Proposal agent

Domain agent for catalog-backed commercial proposals. **Chat audience is sales** — rules are in `agent/instructions.md` (Sales voice).

## Eve split (see `node_modules/eve/docs/skills.mdx`, `sandbox/index.mdx`)

| Layer | Role |
|-------|------|
| **`agent/instructions.md`** | Always-on behavior (sales voice, routing) |
| **`agent/skills/`** | Load-on-demand procedures; supporting **markdown/JSON for the model** under `$HOME/.agents/skills/` in sandbox |
| **`agent/lib/*.ts`** | Tool code imports JSON from the **skill tree** at build time (`blueprint-loader.ts`); do not put loose JSON under `lib/` (Eve discovery rejects it) |
| **`skills/.../references/*.json`** | Declarative blueprint data — compiled to `$HOME/.agents/skills/…` for the model and bundled for tools |
| **`agent/sandbox/workspace/`** | Optional seeds copied to writable `/workspace/` |
| **`/workspace/proposal/`** | Per-session Compose IR (quotation, client, narrative files) |

Do not copy blueprint registry into sandbox for tools. Do not read `/eve/resources` or dev-machine paths from tool code.

## Skills

| Skill | Role |
|-------|------|
| `proposal-catalog-explorer` | PK catalog MCP, matching, `quotation.json` |
| `proposal-cv-explorer` | PK CV MCP, `team.json` (when graph includes team) |
| `proposal-blueprints` | Playbooks, snippets, client-field schema (not registry JSON) |
| `proposal-export` | Ascentium export (Phase 2) |

## Blueprints (MVP)

- `acorp-sg-sme-abs` — SG SME Ascentium Business Services (with About)
- `acorp-sg-sme-rikvin` — SG SME Rikvin (no About)

Registry JSON: `skills/proposal-blueprints/references/`.

## Tools

- `proposal_list_blueprints`
- `proposal_init_compose`
- `proposal_write_compose_file` (includes `extensions/*.json`)
- `proposal_compute_extension` (`first_total_invoice`)
- `ask_question`

Avatar: `frontend/public/agents/avatar7.png` → `/agents/avatar7.png` in registry.

## Integrations

`proposal_knowledge` is wired only on this agent. See [PROPOSAL_KNOWLEDGE_MCP.md](./PROPOSAL_KNOWLEDGE_MCP.md).

## Local dev

```bash
npm run dev:x-proposal   # port 2004
./scripts/start.sh x-proposal
```

Compose IR root: `/workspace/proposal/`.
