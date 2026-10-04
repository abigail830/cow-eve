/** User-visible hint when Eve rejects a stale workflow tool binding (deploy or #3740). */
export function researchWorkflowStaleHint(text: string): string | null {
  const normalized = text.toLowerCase();
  if (
    !normalized.includes("not registered as a workflow") &&
    !normalized.includes("after this run started")
  ) {
    return null;
  }
  return (
    "This chat was bound to an older research deployment. Open a new chat with Ann Researcher " +
    "and send your request again (do not continue this thread after a backend redeploy)."
  );
}

export function extractToolErrorText(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    try {
      return JSON.stringify(output);
    } catch {
      return "";
    }
  }
  return String(output);
}
