export const SUMMARY_LENGTH_GUIDANCE: Record<string, string> = {
  brief:
    "Keep the response short and direct. Use the fewest words needed while still answering each section clearly.",
  moderate:
    "Provide a balanced response with enough context to be useful, but avoid unnecessary repetition.",
  detailed:
    "Provide a fuller response with supporting context, nuance, and clear reasoning where relevant.",
};

export const SUMMARY_COMPLEXITY_GUIDANCE: Record<string, string> = {
  simple: "Use straightforward language and a clear, plain structure.",
  balanced: "Use a balanced level of detail and reasoning, with moderate nuance.",
  deep: "Use more analytical language, connect related points, and explain implications where helpful.",
};

export function buildSummaryControls(input: {
  length?: string;
  complexity?: string;
  focusAreas?: string;
}): string {
  const lengthKey = (input.length ?? "moderate").trim().toLowerCase();
  const complexityKey = (input.complexity ?? "balanced").trim().toLowerCase();
  const lengthInstruction =
    SUMMARY_LENGTH_GUIDANCE[lengthKey] ?? SUMMARY_LENGTH_GUIDANCE.moderate;
  const complexityInstruction =
    SUMMARY_COMPLEXITY_GUIDANCE[complexityKey] ??
    SUMMARY_COMPLEXITY_GUIDANCE.balanced;
  const focusInstruction = input.focusAreas?.trim()
    ? `\nFocus areas: Prioritise ${input.focusAreas.trim()}.`
    : "";
  return (
    "**Output Length and Detail Control:**\n" +
    `Length preference: ${lengthInstruction}\n` +
    `Complexity preference: ${complexityInstruction}` +
    focusInstruction
  );
}
