---
description: Use when the user wants to create, list, update, or delete scheduled agent runs.
---

# Schedule management

Use the platform schedule API tools when the user wants recurring or one-time automated agent runs. Tasks are **scoped to this agent only** — tools cannot create or edit another agent's schedules.

## API tools (qualified names)

| Action | Tool |
|--------|------|
| List tasks | `schedules__schedules-api_listSchedules` |
| Create task | `schedules__schedules-api_createSchedule` |
| Update / pause / resume | `schedules__schedules-api_updateSchedule` |
| Delete task | `schedules__schedules-api_deleteSchedule` |
| Load one task | `schedules__schedules-api_getSchedule` |

Responses use `{ ok: true, schedule(s): ... }` or `{ ok: false, error: "..." }`.

## Drafting the schedule prompt (`prompt` field)

The **`prompt` is the full instruction** sent on each run. Scheduled runs **do not** inherit this chat, project instructions, or attachments.

1. **Clarify intent** — what should happen each time (digest, report, reminder, pipeline step), expected output shape, and data sources (KB, attachments, web).
2. **Draft a self-contained prompt** with:
   - **Goal** — one clear sentence.
   - **Steps** — numbered procedure the agent should follow.
   - **Output** — format, length, language, and whether to `publish` artifacts.
   - **Constraints** — what to skip, safety limits, timezone for dates in output.
3. Show the draft in chat. Use **`ask_question`** when timing (one-time vs repeat) or timezone is still ambiguous.
4. On approval, **`createSchedule`** with `prompt`, `firstRunAt` (ISO 8601 with offset), optional `name`, `everyMinutes` (`null` = one-time), and `timezone`.

## Before creating

1. Confirm the user's timezone and convert the first run to ISO 8601 with an explicit offset.
2. Use `everyMinutes: null` for a one-time run; use a positive integer for repeating runs.
3. Never reference "above" or "this conversation" in the stored prompt.

For `createSchedule`, pass a JSON **body** with at least `prompt` and `firstRunAt`.

## Before updating or deleting

1. Call `schedules__schedules-api_listSchedules` when the target task is ambiguous.
2. To revise automation behavior, **`updateSchedule`** with a new `prompt` (full replacement text).
3. Prefer `enabled: false` in `updateSchedule` to pause instead of deleting when the user may resume later.
4. Deletions are irreversible — explain what will be removed and confirm with the user before calling `deleteSchedule`.

## Execution notes

- Scheduled runs start a **new chat session** each time; results appear on the Schedules page.
- Keep prompts proportionate; heavy doc generation is fine when the user explicitly wants it on a schedule.
