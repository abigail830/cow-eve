const CJK_REGEX = /\p{Script=Han}/u;

export type ChatTitleScriptMode = "cjk" | "latin";

export function detectChatTitleScriptMode(text: string): ChatTitleScriptMode {
  let han = 0;
  let latin = 0;
  for (const char of text) {
    if (CJK_REGEX.test(char)) han += 1;
    else if (/[A-Za-z]/.test(char)) latin += 1;
  }
  const total = han + latin;
  if (total === 0) return "latin";
  return han / total >= 0.4 ? "cjk" : "latin";
}

function graphemeCount(text: string): number {
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(text)].length;
  }
  return [...text].length;
}

function truncateGraphemes(text: string, max: number): string {
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const parts: string[] = [];
    for (const { segment } of segmenter.segment(text)) {
      if (parts.length >= max) break;
      parts.push(segment);
    }
    const out = parts.join("");
    return out.length < text.length ? `${out}…` : out;
  }
  const out = [...text].slice(0, max).join("");
  return out.length < text.length ? `${out}…` : out;
}

function clampLatinTitle(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const maxWords = 8;
  const maxChars = 48;
  let clipped = words.slice(0, maxWords).join(" ");
  if (clipped.length > maxChars) {
    clipped = clipped.slice(0, maxChars).trim();
    const lastSpace = clipped.lastIndexOf(" ");
    if (lastSpace > 20) clipped = clipped.slice(0, lastSpace);
    clipped = `${clipped}…`;
  }
  return clipped;
}

function clampCjkTitle(text: string): string {
  const maxGraphemes = 16;
  return truncateGraphemes(text.replace(/\s+/g, ""), maxGraphemes);
}

/** Normalize LLM output for sidebar display (not applied to user renames). */
export function clampChatTitle(raw: string, hintText: string): string {
  let text = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/[.!?。！？]+$/u, "").trim();
  if (!text) return "";

  const mode = detectChatTitleScriptMode(`${hintText}\n${text}`);
  return mode === "cjk" ? clampCjkTitle(text) : clampLatinTitle(text);
}
