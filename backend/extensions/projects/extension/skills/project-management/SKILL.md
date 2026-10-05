---
description: Use when the user wants to create or update a project, draft standing project instructions, or bind this chat to a project.
---

# Project management

Projects hold **standing instructions** (tone, audience, terminology, delivery defaults) injected on every turn while a chat is bound to that project. They are **scoped to this agent only** — you cannot create or edit another agent's projects.

**Do not pass `agentId` or `eveSessionId` yourself** — the platform injects them on every projects API call. After **`createProject`**, call **`listProjects`** or **`getProject`** with the returned `id` to confirm the row exists before **`updateProject`** or **`bindChatSession`**.

## API tools (qualified names)

| Action | Tool |
|--------|------|
| List projects | `projects__projects-api_listProjects` |
| Create project | `projects__projects-api_createProject` |
| Load one project | `projects__projects-api_getProject` |
| Update name / instructions | `projects__projects-api_updateProject` |
| Delete project | `projects__projects-api_deleteProject` |
| Apply project to **this chat** | `projects__projects-api_bindChatSession` |

Responses use `{ ok: true, project(s): ... }` or `{ ok: false, error: "..." }`.

## Drafting project instructions

1. **Interview lightly** — goal of the project, primary audience, language, forbidden patterns, preferred deliverable formats, KB or terminology constraints.
2. **Draft in structured sections**, for example:
   - **Purpose** — one short paragraph.
   - **Audience & tone** — who reads outputs; formality level.
   - **Terminology & naming** — product names, acronyms, locale (e.g. China vs global).
   - **Delivery defaults** — deck vs doc, citation style, when to use KB.
   - **Out of scope** — what this project does *not* cover.
3. Show the draft in chat for review. Use **`ask_question`** when the user must pick between materially different instruction sets.
4. On approval, **`createProject`** or **`updateProject`** with the final `instructions` text. Keep instructions concise but complete (standing rules, not one-off task text).

## Creating a project

1. Confirm the **display name** if ambiguous.
2. Prefer creating with a solid instruction draft rather than an empty project.
3. After create, ask whether to **bind this chat** so instructions apply immediately. If yes, call **`bindChatSession`** with the new `projectId`. Pass `projectId: null` only when explicitly clearing project scope from this chat.

## Updating instructions

1. Call **`getProject`** when you need the current text before a large rewrite.
2. For small edits, patch via **`updateProject`** with the full revised `instructions` string (there is no partial merge API).
3. Summarize what changed for the user after a substantive update.

## Projects vs memory vs schedules

| Mechanism | Use for |
|-----------|---------|
| **Project instructions** | Standing rules for a **workspace** of related chats |
| **Memory** | Durable **user** preferences and facts (not full instruction blocks) |
| **Scheduled task `prompt`** | Self-contained **one-shot** automation each run (no prior chat context) |

Do not store entire project instruction bodies in memory.

## Safety

- **Delete** only after explicit user confirmation — deletion is soft but removes project scope from future binds.
- Do not put secrets, tokens, or credentials in project instructions.
