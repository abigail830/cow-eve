/** Pure hash — safe to import from workflow tool modules (no defineState). */
export function findingId(
  subQuestionId: string,
  claim: string,
  source: string,
): string {
  let h = 5381;
  const s = `${subQuestionId}\0${claim}\0${source}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
