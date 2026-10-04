# LRQA account report HTML (Brief & CDP)

**Sandbox path (after skills sync):**  
`/workspace/skills/lrqa-account-brief/references/html-account-report.md`

Build **one self-contained `.html` file** (inline CSS, no external assets). Open in browser for print/PDF.

## Design tokens

```css
:root {
  --font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  --font-zh: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', sans-serif;
  --teal: #00D4C8;
  --dark-navy: #0A1628;
  --light-gray: #F8F9FA;
  --mid-gray: #6B7280;
  --border-gray: #E5E7EB;
  --nav-width: 260px;
}
```

## Layout pattern

- Fixed **left sidebar** (`.sidebar`): brand `LRQA`, subtitle (`Account Brief` or `Client Development Plan`), nav links to `#s1`…`#s9`.
- **Main** (`.main`): hero `#hero`, then `.content-section` blocks with `id="s1"` etc.
- **Mobile:** checkbox `#nav-toggle`, `.mobile-header`, `.nav-overlay` (copy from Yili/Wanhua samples if needed).
- **Optional bilingual:** `body[data-lang="en"|"zh"]`, `.en-only` / `.zh-only`, `.lang-toggle` buttons.

## Hero

- `.hero-brand` LRQA, tagline “Connected risk management”.
- `.hero-title` = client legal/name; `.hero-sub` = document type.
- `.hero-meta`: date, **INTERNAL LRQA USE**, source note; `.conf` in red for confidential CDP.
- Brief: optional `.hero-warning` (category sensitivity). CDP: optional `.hero-pills` (`.pill`, `.pill-teal`, `.pill-amber`, `.pill-red`).

## Typography & components

- `h1` section titles with bottom border; `.lead` for opening paragraph.
- **Tables:** black header row, zebra tbody (see Brief sample).
- **Callouts:** `.callout`, `.callout-title`, `.callout-body`; variants `.callout-blue`, `.callout-warning`.
- **Badges:** `.badge`, `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-blue`.

## CDP-only: expansion map

```html
<div class="map">
  <div class="mod adopted">
    <div class="nm">Product or agreement name</div>
    <div class="id">QA-LRQA-010 · note</div>
    <div class="st"><span class="badge badge-green">Adopted — since YYYY</span></div>
  </div>
  <!-- repeat; use badge-amber for in-scope-not-taken-up, badge-blue for cross-sell -->
</div>
```

**Play rows:** `.prow` with `.t` (title + code + likelihood) and `.m` (move narrative).

## Minimal shell (start here)

Replace placeholders; expand sections per loaded skill (Brief vs CDP nav).

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LRQA Account Brief — CLIENT</title>
<style>
  /* paste :root + sidebar + main + hero + content-section + h1/h2 + table + callout + badge rules */
</style>
</head>
<body data-lang="en">
<nav class="sidebar">
  <div class="nav-brand">LRQA</div>
  <div class="nav-subtitle">Account Brief</div>
  <a class="nav-link" href="#s1"><span class="nav-num">01</span>Quick take</a>
  <!-- s2–s9 per Brief or CDP skill -->
</nav>
<div class="main">
  <div class="hero" id="hero">…</div>
  <div class="content-section" id="s1"><h1>1. Quick take</h1>…</div>
  <!-- s2–s9 -->
</div>
<script>
  /* optional: nav-link active on scroll; lang toggle */
</script>
</body>
</html>
```

## Publish checklist

1. Valid HTML, all sections present per skill.
2. §9 includes sources/confidence or guardrails/provenance.
3. No fabricated CRM numbers or product codes.
4. Write file under `/workspace/research/`, then **`publish`** with that path.

## Full styling reference

Internal drafts in repo (do not commit client text into reports):  
`docs/07 DRAFT LRQA_Account_Brief_Yili_v2.html`, `docs/04 DRAFT LRQA_CDP_Wanhua_2026-08_v2.html`.
