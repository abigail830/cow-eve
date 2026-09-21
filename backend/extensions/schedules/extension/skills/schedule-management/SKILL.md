---
description: Use when the user wants to create, list, update, or delete scheduled agent runs.
---

# Schedule management

Use the platform schedule API tools when the user wants recurring or one-time automated agent runs.

## API tools (qualified names)

| Action | Tool |
|--------|------|
| List tasks | `schedules__schedules-api_listSchedules` |
| Create task | `schedules__schedules-api_createSchedule` |
| Update / pause / resume | `schedules__schedules-api_updateSchedule` |
| Delete task | `schedules__schedules-api_deleteSchedule` |
| Load one task | `schedules__schedules-api_getSchedule` |

Responses use `{ ok: true, schedule(s): ... }` or `{ ok: false, error: "..." }`.

## Before creating

1. Confirm the user's timezone and convert the first run to ISO 8601 with an explicit offset.
2. Use `everyMinutes: null` for a one-time run; use a positive integer for repeating runs.
3. Keep prompts self-contained — scheduled runs start a fresh session without prior chat context.

For `createSchedule`, pass a JSON **body** with at least `prompt` and `firstRunAt`.

## Before updating or deleting

1. Call `schedules__schedules-api_listSchedules` when the target task is ambiguous.
2. Prefer `enabled: false` in `updateSchedule` to pause instead of deleting when the user may resume later.
3. Deletions are irreversible — explain what will be removed and confirm with the user before calling `deleteSchedule`.

## Execution notes

- Scheduled runs are lightweight tasks; delegate to a content specialist subagent only when the prompt requires documents or heavy writing.
- Mention that results appear as new chat sessions the user can open from the Schedules page.
