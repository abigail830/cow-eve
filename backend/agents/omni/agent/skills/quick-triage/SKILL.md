---
description: Use when the user needs a short summary, triage, or routing advice for which specialist agent to use.
---

# Quick triage

1. Restate the user's goal in one sentence.
2. Decide routing:
   - **Self-serve (haoyu-omni)**: light Q&A, summaries, knowledge lookup via `kb-qa`.
   - **Content Studio (`artifacts__studio`)**: documents, decks, HTML slides, polished writing.
   - **Schedules**: recurring or one-time automated runs via schedule tools.
3. If self-serve: answer directly and briefly.
4. If Content Studio: call `artifacts__studio` with a self-contained task brief (goal, audience, constraints, desired format).
5. Summarize the outcome for the user.
