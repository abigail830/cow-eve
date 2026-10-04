# Example project: LRQA Account Brief (Phase 2)

Use as **standing instructions** when creating a platform Project bound to the **research** (Ann Researcher) agent.

## Suggested project name

`LRQA Account Brief`

## Suggested project instructions (paste into Project editor)

```markdown
## Purpose
Produce an internal **account brief** for LRQA sales and client teams: understand the company, pressures, and conversation angles—not a generic company wiki or a CDP.

## Audience & tone
Internal LRQA use. Professional, direct, evidence-led. Match the user's language (English or bilingual EN/ZH) unless they specify otherwise.

## Research behavior
- Load **deep-research** + **lrqa-account-brief**.
- Show a research plan, then retrieve, then **publish** LRQA HTML (default) or Markdown if requested.
- New accounts: expect web to carry most facts; HubSpot/KB may be empty—state what is unknown.
- Never invent CRM fields (contract value, renewal date, contacts). HubSpot hits only when present.
- Include **Sources & confidence** (high/medium/low with brief basis).
- For food/dairy clients: sector history (e.g. 2008) only as **industry context**, never as allegations against the named company.

## Deliverable
Nine-chapter LRQA Account Brief HTML (see skill reference `html-account-report.md`): Quick take → … → Sources & confidence.

## Quality reference
Compare depth and honesty to `docs/07 DRAFT LRQA_Account_Brief_Yili_v2.html` (repo, internal).
```

## How to try

1. Start `npm run dev:research` (port 2002) and platform API on omni (2000) if using projects/KB locally.
2. Open **Ann Researcher** in the web UI.
3. Create a project with the instructions above; bind the chat.
4. Prompt example: `Research Inner Mongolia Yili Group for an internal LRQA account brief ahead of a first meeting; LRQA HTML.`

See also [PROJECT_TEMPLATES.md](./PROJECT_TEMPLATES.md) and [EVAL.md](./EVAL.md).
