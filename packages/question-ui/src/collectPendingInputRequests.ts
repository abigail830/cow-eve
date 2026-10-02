import type { EveMessage, EveMessagePart } from "eve/react";

export type EveInputRequest = NonNullable<
  NonNullable<
    Extract<EveMessagePart, { type: "dynamic-tool" }>["toolMetadata"]
  >["eve"]
>["inputRequest"];

export type PendingHitlItem = {
  readonly request: NonNullable<EveInputRequest>;
  readonly toolName: string;
  readonly toolCallId: string;
};

function isDynamicToolPart(
  part: EveMessagePart,
): part is Extract<EveMessagePart, { type: "dynamic-tool" }> {
  return part.type === "dynamic-tool";
}

/** Pending HITL on a single tool part (`approval-requested` + `inputRequest`). */
export function extractPendingHitlFromPart(
  part: EveMessagePart,
): PendingHitlItem | null {
  if (!isDynamicToolPart(part)) return null;
  if (part.state !== "approval-requested") return null;
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) return null;
  return {
    request,
    toolName: part.toolName,
    toolCallId: part.toolCallId,
  };
}

/** All open input requests across the session (deduped by `requestId`). */
export function collectPendingInputRequests(
  messages: readonly EveMessage[],
): PendingHitlItem[] {
  const seen = new Set<string>();
  const out: PendingHitlItem[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      const item = extractPendingHitlFromPart(part);
      if (!item || seen.has(item.request.requestId)) continue;
      seen.add(item.request.requestId);
      out.push(item);
    }
  }
  return out;
}
