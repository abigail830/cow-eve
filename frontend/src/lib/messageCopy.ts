import type { EveMessage, EveMessagePart } from "eve/react";
import { userVisibleTextFromParts } from "./userMessageAttachments";

export function userMessageCopyText(parts: EveMessage["parts"]): string {
  return userVisibleTextFromParts(parts);
}

export function assistantMessageCopyText(parts: readonly EveMessagePart[]): string {
  const blocks: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && "text" in part) {
      const t = part.text.trim();
      if (t) blocks.push(t);
      continue;
    }
    if (part.type === "reasoning" && "text" in part) {
      const t = part.text.trim();
      if (t) blocks.push(`Reasoning\n${t}`);
      continue;
    }
    if (part.type === "dynamic-tool") {
      const name = "toolName" in part ? String(part.toolName) : "tool";
      const output = "output" in part ? part.output : null;
      if (output != null) {
        blocks.push(
          `${name}\n${typeof output === "string" ? output : JSON.stringify(output, null, 2)}`,
        );
      }
    }
  }
  return blocks.join("\n\n").trim();
}
