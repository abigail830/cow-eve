# Example project: LRQA Client Development Plan (Phase 2)

Use as **standing instructions** for a platform Project bound to the **research** (Ann Researcher) agent. Load skill **`lrqa-client-development-plan`** (plus **`deep-research`**) when executing.

## Suggested project name

`LRQA Client Development Plan`

## Suggested project instructions

```markdown
## Purpose
Produce an internal **Client Development Plan (CDP)** for an LRQA account owner: current engagement, expansion map across solution lines, thesis, plays, and 30-day actions—not a first-meeting account brief.

## Audience & tone
Internal LRQA only. **CONFIDENTIAL** on the HTML hero. Direct, evidence-led. Match user language (EN or EN+ZH toggle) unless specified.

## Research behavior
- Load **deep-research** + **lrqa-client-development-plan**.
- Prioritize **HubSpot**, workspace attachments, and KB for engagement, contacts, and product/catalog facts; use **web** for market/regulatory context.
- **Current engagement (§2)** and **expansion map (§4)** must reflect sourced facts only.
- Omit C-1 / C-5 style blocks if renewal, value, term, or health score are not in CRM—**say they are omitted**, do not estimate.
- Product codes only when catalog/KB/HubSpot supports them; otherwise name in words + TBD.
- Deliver **LRQA HTML** via `publish` (see skill reference `html-account-report.md`).

## Deliverable
Nine-chapter CDP HTML aligned with Wanhua v2 structure: plan in one line → current engagement → profile → expansion map → synthesis → thesis → plays → execution → guardrails & provenance.

## Quality reference
Compare structure and honesty to `docs/04 DRAFT LRQA_CDP_Wanhua_2026-08_v2.html` (repo, internal).
```

## How to try

1. `./scripts/restart.sh` or `npm run dev:research` (2002) + omni platform (2000).
2. Open **Ann Researcher** in the web UI.
3. Create/bind this project; attach any account-position notes if available.
4. Example prompt: `Build a CDP for Wanhua Chemical using HubSpot and our attached account notes; HTML output.`
