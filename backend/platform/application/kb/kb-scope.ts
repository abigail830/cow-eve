export const KB_SCOPE_INSTRUCTION_MARKER =
  "Enabled hybrid-search knowledge bases (platform-managed)";

export function enabledKbIds(input: {
  visibleIds: readonly string[];
  disabledIds: readonly string[];
}): string[] {
  const disabled = new Set(
    input.disabledIds.map((id) => id.trim()).filter(Boolean),
  );
  return input.visibleIds.filter((id) => !disabled.has(id));
}

export function formatKbScopeInstructionLine(
  enabledItems: readonly { id: string; name: string }[],
): string {
  if (enabledItems.length === 0) {
    return `${KB_SCOPE_INSTRUCTION_MARKER}: none enabled — do not call hybrid_search.`;
  }
  const parts = enabledItems.map(
    (item) => `${item.name.trim() || item.id} (${item.id})`,
  );
  return (
    `${KB_SCOPE_INSTRUCTION_MARKER}: only use these kb_ids — ${parts.join("; ")}. ` +
    "Pass only these ids to hybrid_search; do not search other knowledge bases."
  );
}
