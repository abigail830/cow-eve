# Human-in-the-loop question UI (Eve HITL)

Cow Eve uses **Eve’s native HITL protocol** for clarifying questions and tool approvals—not a parallel “product turn” like [Platform Product Turns](./PLATFORM_PRODUCT_TURNS.md).

## Server

- **Clarification:** built-in [`ask_question`](https://eve.dev/docs/concepts/built-in-tools) (omni: [`backend/agents/omni/agent/tools/ask_question.ts`](../../backend/agents/omni/agent/tools/ask_question.ts)).
- **Tool gates:** `approval` on `defineTool` ([Human-in-the-loop](https://eve.dev/docs/tools/human-in-the-loop)).
- **Pause:** `input.requested` → durable `session.waiting` → resume on client `inputResponses`.

## Client

- Hook: `useEveAgent().respond(inputResponses)` ([Building a frontend — HITL](https://eve.dev/docs/guides/frontend/overview#human-in-the-loop-prompts)).
- UI package: [`@fde/question-ui`](../../packages/question-ui/) renders pending requests from `dynamic-tool` parts:
  - `state === "approval-requested"` (questions use this state too)
  - `part.toolMetadata.eve.inputRequest` with `kind`: `question` | `tool-approval` | `session-limit`
- Wiring: [`AgentChat.tsx`](../../frontend/src/components/AgentChat.tsx), [`MessageStream.tsx`](../../frontend/src/components/MessageStream.tsx).

## Omni prompt

[`backend/agents/omni/agent/instructions.md`](../../backend/agents/omni/agent/instructions.md) tells the model to prefer **`ask_question`** when blocked (not plain-text-only clarification). Project instructions and user messages still take precedence when they do not violate platform invariants (`publish`, KB access, memory secrets).

## Manual verification

1. Ask omni for a deck without specifying format → expect `ask_question` card → submit → turn continues.
2. Reload chat with a parked session → card still actionable via `respond`.
3. Artifact `publish` cards and audio product turns unchanged.
