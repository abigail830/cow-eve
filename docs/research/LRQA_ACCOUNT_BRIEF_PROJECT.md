# Example project: LRQA Account Brief (Phase 1 seed)

Use this as **standing instructions** when creating a platform Project bound to the **research** agent. Phase 1 does not ship a dedicated LRQA skill; the generic `deep-research` skill plus these rules should produce a Markdown brief comparable in spirit to [Yili Account Brief](../07%20DRAFT%20LRQA_Account_Brief_Yili_v2.html).

## Suggested project name

`LRQA Account Brief`

## Suggested project instructions (paste into Project editor)

```markdown
## Purpose
Produce an internal **account brief** for LRQA sales and client teams: understand the company, pressures, and conversation angles—not a generic company wiki.

## Audience & tone
Internal LRQA use. Professional, direct, evidence-led. Match the user's language (English or Chinese) unless they specify otherwise.

## Research behavior
- Load deep-research workflow: show a research plan, then retrieve, then publish a Markdown report.
- New accounts: expect web to carry most facts; HubSpot/KB may be empty—state what is unknown.
- Never invent CRM fields (contract value, renewal date, contacts). HubSpot hits only when present.
- Include **Sources & confidence** (high/medium/low with brief basis).
- For food/dairy clients: sector history (e.g. 2008) only as **industry context**, never as allegations against the named company.

## Deliverable
Published Markdown report with sections similar to: Quick take → Company profile → Operations / footprint → Pressure points → Where LRQA might fit (if user wants commercial angle) → Questions to ask → Sources & confidence.

## Quality reference
Compare depth and honesty to the Yili example brief in repo docs (not a mandatory HTML template in Phase 1).
```

## How to try

1. Start `npm run dev:research` (port 2002) and platform API on omni (2000) if using projects/KB locally.
2. Open **Deep Research** agent in the web UI.
3. Create a project with the instructions above; bind the chat.
4. Prompt example: `Research Inner Mongolia Yili Group for an internal LRQA account brief ahead of a first meeting.`
