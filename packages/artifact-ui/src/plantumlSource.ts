/** Extract PlantUML source from a deliverable filename or text body. */
export function extractPlantUmlSource(content: string | null | undefined): string | null {
  const raw = content?.trim();
  if (!raw) return null;
  if (/^@startuml/i.test(raw)) return raw;
  const fenced = raw.match(/```(?:plantuml|puml)?\s*\r?\n([\s\S]*?)```/i);
  if (fenced && /@startuml/i.test(fenced[1])) return fenced[1].trim();
  return null;
}

export function isPlantUmlFilename(filename: string): boolean {
  const name = filename.toLowerCase();
  return name.endsWith(".puml") || name.endsWith(".plantuml");
}

export function isRasterImageFilename(filename: string): boolean {
  const name = filename.toLowerCase();
  return (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp")
  );
}

/** Detect UTF-8 decode of binary files (e.g. PNG published as markdown). */
export function isLikelyBinaryText(content: string): boolean {
  if (!content) return false;
  if (content.includes("\0")) return true;
  if (content.startsWith("PNG\r\n") || content.startsWith("\u0089PNG")) return true;
  const sample = content.slice(0, 4096);
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0xfffd) suspicious++;
    else if (code < 32 && code !== 9 && code !== 10 && code !== 13) suspicious++;
  }
  return sample.length > 0 && suspicious / sample.length > 0.02;
}
