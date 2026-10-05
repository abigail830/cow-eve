import type { Citation, StructuredDraftEnvelope, StructuredDraftSection } from "./structured-draft.js";

type SourceContext = {
  sourceText: string;
};

const MIN_EXCERPT = 24;

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function findSourceExcerpt(body: string, sourceText: string): string | null {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length < MIN_EXCERPT) return null;
  const normSource = normalizeForMatch(sourceText);
  const maxWindow = Math.min(120, trimmed.length);
  for (let len = maxWindow; len >= MIN_EXCERPT; len -= 8) {
    for (let i = 0; i <= trimmed.length - len; i += 1) {
      const window = trimmed.slice(i, i + len);
      if (normalizeForMatch(window).length < MIN_EXCERPT) continue;
      if (normSource.includes(normalizeForMatch(window))) {
        return window.trim();
      }
    }
  }
  return null;
}

function parseDocumentFilenames(sourceText: string): string[] {
  const names: string[] = [];
  const re = /^--- Document: (.+?) ---$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceText)) !== null) {
    names.push(m[1]!);
  }
  return names;
}

function sectionFilenameHint(body: string, filenames: string[]): string | undefined {
  const lower = body.toLowerCase();
  for (const name of filenames) {
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    if (base.length >= 4 && lower.includes(base.slice(0, Math.min(base.length, 12)))) {
      return name;
    }
  }
  return filenames[0];
}

function enrichSection(
  section: StructuredDraftSection,
  ctx: SourceContext,
  filenames: string[],
): StructuredDraftSection {
  const body = section.body.trim();
  if (!body || body === "—") {
    const flags = new Set(section.flags ?? []);
    flags.add("verify");
    return { ...section, body: body || "—", flags: [...flags] };
  }

  const excerpt = findSourceExcerpt(body, ctx.sourceText);
  const flags = new Set(section.flags ?? []);
  const citations: Citation[] = [...(section.citations ?? [])];

  if (excerpt) {
    const filename = sectionFilenameHint(body, filenames);
    citations.push({
      filename,
      excerpt: excerpt.length > 280 ? `${excerpt.slice(0, 280)}…` : excerpt,
    });
  } else if (body.length >= MIN_EXCERPT) {
    flags.add("verify");
  }

  return {
    ...section,
    citations: citations.length ? citations : section.citations,
    flags: flags.size ? [...flags] : section.flags,
  };
}

export function enrichEnvelopeFromSource(
  draft: StructuredDraftEnvelope,
  sourceText: string,
): StructuredDraftEnvelope {
  const ctx: SourceContext = { sourceText };
  const filenames = parseDocumentFilenames(sourceText);
  const sections = draft.sections.map((s) => enrichSection(s, ctx, filenames));

  const unsupported: NonNullable<StructuredDraftEnvelope["unsupported"]> = [
    ...(draft.unsupported ?? []),
  ];
  for (const section of sections) {
    if (section.flags?.includes("verify") && section.body.trim() && section.body !== "—") {
      unsupported.push({
        sectionId: section.id,
        reason: "Could not match section text to provided source excerpts; verify against evidence.",
      });
    }
    if ((!section.body.trim() || section.body === "—") && draft.status === "degraded") {
      unsupported.push({
        sectionId: section.id,
        reason: "Field missing from model JSON; review raw output.",
      });
    }
  }

  const deduped = unsupported.filter(
    (u, i, arr) => arr.findIndex((x) => x.sectionId === u.sectionId && x.reason === u.reason) === i,
  );

  return {
    ...draft,
    sections,
    unsupported: deduped.length ? deduped : draft.unsupported,
  };
}
