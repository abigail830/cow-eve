# cow-eve

Monorepo: `backend/` (Eve agents + platform API), `frontend/` (chat UI).

## Language

**English-only product UI.** All user-visible strings in the frontend (placeholders, errors, labels, aria text, attachment/mention copy) must be English. See `.cursor/rules/english-ui.mdc`.

Backend agent `instructions.md` may match the user's language when they write in Chinese; the web app itself stays English.

## Backend agents

See [backend/AGENTS.md](backend/AGENTS.md) for Eve authoring conventions.

## Platform product turns (composer cards in chat)

User-initiated product flows (e.g. audio transcript) must be recorded as **Platform Product Turns** on the Eve stream, not a parallel UI list. See [backend/platform/docs/PLATFORM_PRODUCT_TURNS.md](backend/platform/docs/PLATFORM_PRODUCT_TURNS.md).
