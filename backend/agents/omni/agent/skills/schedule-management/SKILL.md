---
description: Use when the user wants to create, list, update, or delete scheduled omni agent runs.
---

# Schedule management

Use the schedule tools when the user wants recurring or one-time automated agent runs.

## Before creating

1. Confirm the user's timezone and convert the first run to ISO 8601 with an explicit offset.
2. Use `everyMinutes: null` for a one-time run; use a positive integer for repeating runs.
3. Keep prompts self-contained — scheduled runs start a fresh omni session without prior chat context.

## Before updating or deleting

1. Call `list_schedules` when the target task is ambiguous.
2. Prefer `enabled: false` to pause instead of deleting when the user may resume later.
3. Deletions require user approval — explain what will be removed.

## Execution notes

- Scheduled runs are lightweight omni tasks; delegate to Content Studio only when the prompt requires documents or heavy writing.
- Mention that results appear as new chat sessions the user can open from the Schedules page.
