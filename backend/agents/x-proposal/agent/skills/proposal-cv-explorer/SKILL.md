---
name: proposal-cv-explorer
description: PK CV explorer — search_people and get_person for team proposal sections.
---

# Proposal CV explorer

Load only when blueprint graph includes team/CV components (e.g. audit deck).

## MCP (`proposal-cv`)

1. `list_departments` if needed.
2. `search_people` with business_unit / department filters.
3. `get_person` for bios and avatar URLs.

Write **`team.json`** via **`proposal_write_compose_file`**.
