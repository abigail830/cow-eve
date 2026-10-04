---
description: LRQA internal account brief—nine-chapter skeleton, public-source bias, confidence table, LRQA HTML delivery. Load when the user asks for an account brief, client brief, or LRQA-style pre-meeting pack for a named company.
---

# LRQA account brief

Use with **`deep-research`**: plan → retrieve → write → **`publish`**. This skill defines **chapter skeleton, guardrails, and HTML layout** for LRQA Account Briefs (not Client Development Plans).

## When to load

- User or Project mentions **account brief**, **LRQA brief**, **pre-meeting brief**, or points at the Yili-style nine-chapter format.
- **Do not** load for generic industry scans or non-LRQA reports—stay on L0 `deep-research` only.

## Deliverable

- Default: **single-file LRQA HTML** at `/workspace/research/account-brief-<slug>.html` (see **`references/html-account-report.md`** for CSS, nav, EN/ZH pattern, hero).
- Fallback: Markdown at `/workspace/research/report.md` only if the user explicitly wants Markdown or HTML is out of scope.
- Always **`publish`** the final file; chat = short summary only.

## Nine chapters (Brief)

Use `id="s1"` … `id="s9"` and matching sidebar links:

| # | EN | ZH (if bilingual) |
|---|----|-------------------|
| 1 | Quick take | 要点速览 |
| 2 | Company profile | 公司概况 |
| 3 | Where they operate | 运营足迹 |
| 4 | Upstream supply chain | 上游供应链 |
| 5 | Pressure points | 压力点 |
| 6 | Where LRQA fits | LRQA 的切入点 |
| 7 | People & the room | 人与场面判读 |
| 8 | Questions to ask | 应问的问题 |
| 9 | Sources & confidence | 来源与置信度 |

## Research bias

- **Public sources carry most facts** for net-new accounts; HubSpot/KB/workspace when they add real value (explain in plan).
- §9 must include a **confidence table** (high / medium / low + brief basis). Note conflicting public figures explicitly.
- **Guardrails:** Industry history (e.g. sector-wide incidents) is **context only**—never frame as findings about the named company unless sourced to them. Sensitive categories (infant formula, recalls): add a visible hero warning when relevant.

## CRM / internal

- HubSpot: **write only verified fields**. Missing renewal, contract value, contacts → state **unknown**, do not estimate.
- Do **not** use CDP-only blocks (expansion map, product catalog states, C-1/C-5 strips).

## Bilingual UI (optional)

If the user or Project asks for EN+ZH, follow the `en-only` / `zh-only` + `data-lang` toggle pattern in **`references/html-account-report.md`**. Otherwise English-only is fine.

## Quality reference

Repo examples (internal, not for verbatim copy): `docs/07 DRAFT LRQA_Account_Brief_Yili_v2.html`. Match **depth, honesty, and structure**, not confidential client text.
