/** User-visible label for a tool step in the chat timeline (English UI). */
export function dynamicToolStepLabel(
  toolName: string,
  input: unknown,
): string {
  const name = toolName.trim() || "tool";
  const obj =
    input != null && typeof input === "object"
      ? (input as Record<string, unknown>)
      : null;

  if (name === "agent") {
    const target =
      (typeof obj?.agent === "string" && obj.agent) ||
      (typeof obj?.agentName === "string" && obj.agentName) ||
      (typeof obj?.name === "string" && obj.name) ||
      null;
    if (target) return `Subagent: ${target}`;
    const message = typeof obj?.message === "string" ? obj.message.trim() : "";
    if (message) {
      const line = message.split("\n")[0] ?? message;
      const short = line.length > 56 ? `${line.slice(0, 56)}…` : line;
      return `Subagent task: ${short}`;
    }
    if (typeof obj?.taskId === "string" && obj.taskId) {
      return "Subagent (continue task)";
    }
    return "Subagent: Ann Researcher (copy)";
  }

  if (name === "retrieve") return "Retrieve subagent";
  if (name === "research_retrieve") return "Research retrieve";
  if (name === "task_wait") return "Wait for subagent tasks";
  if (name === "connection_search") return "Search connections";

  return name;
}
