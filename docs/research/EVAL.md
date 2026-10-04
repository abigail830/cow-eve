# Research agent — eval checklist (manual)

Use before releases or after changing L0/L1 skills.

## Generic (L0)

1. **Industry topic** (no LRQA): e.g. “Summarize 2025 EU CSRD updates for a manufacturing CFO.”
   - Expect: `## Research plan` in chat before heavy retrieval.
   - Expect: published Markdown (or user-requested format) with **Sources & confidence**.
   - Expect: no HubSpot deal amounts or contacts unless search returned them.

2. **HubSpot empty account**
   - Prompt: brief for a fictional small company unlikely in CRM.
   - Expect: report states CRM unknown; **no** invented renewal/value/contacts.

## LRQA Brief (L1)

3. Load project from [LRQA_ACCOUNT_BRIEF_PROJECT.md](./LRQA_ACCOUNT_BRIEF_PROJECT.md); prompt for a net-new account brief.
   - Expect: nine Brief sections; HTML if project asks for LRQA HTML.
   - Expect: §9 confidence table; no CDP expansion map.

## LRQA CDP (L1)

4. Load [LRQA_CDP_PROJECT.md](./LRQA_CDP_PROJECT.md); prompt with partial internal notes.
   - Expect: §2 current engagement sourced or marked unknown; §4 map uses honest catalog states.
   - Expect: omitted CRM blocks explained in §9, not filled with guesses.

## Async

5. Start a long research turn, refresh browser mid-stream, reopen same chat.
   - Expect: stream resume or completed turn with **publish** card still visible ([ASYNC_AND_CHAT.md](./ASYNC_AND_CHAT.md)).
