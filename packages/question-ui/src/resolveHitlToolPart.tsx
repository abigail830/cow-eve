import type { ReactNode } from "react";
import type { InputResponse } from "eve/client";
import type { EveMessagePart } from "eve/react";
import { extractPendingHitlFromPart } from "./collectPendingInputRequests";
import { HitlPromptCard, type HitlRespondedSnapshot } from "./HitlPromptCard";

function respondedSnapshot(
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>,
): HitlRespondedSnapshot | null {
  const request = part.toolMetadata?.eve?.inputRequest;
  const response = part.toolMetadata?.eve?.inputResponse;
  if (!request || !response) return null;
  const option = request.options?.find(
    (o: { id: string }) => o.id === response.optionId,
  );
  return {
    requestId: request.requestId,
    optionId: response.optionId,
    text: response.text,
    optionLabel: option?.label,
  };
}

export function resolveHitlToolPart(input: {
  part: EveMessagePart;
  onRespond: (responses: InputResponse[]) => void | Promise<void>;
  responding?: boolean;
}): ReactNode | null {
  if (input.part.type !== "dynamic-tool") return null;

  const pending = extractPendingHitlFromPart(input.part);
  if (pending) {
    return (
      <div className="msg-hitl">
        <HitlPromptCard
          item={pending}
          disabled={input.responding === true}
          onRespond={input.onRespond}
        />
      </div>
    );
  }

  if (
    input.part.state === "approval-responded" ||
    input.part.state === "output-denied"
  ) {
    const snapshot = respondedSnapshot(input.part);
    const request = input.part.toolMetadata?.eve?.inputRequest;
    if (!request || !snapshot) return null;
    return (
      <div className="msg-hitl">
        <HitlPromptCard
          item={{
            request,
            toolName: input.part.toolName,
            toolCallId: input.part.toolCallId,
          }}
          onRespond={input.onRespond}
          responded={
            input.part.state === "output-denied"
              ? {
                  requestId: request.requestId,
                  optionLabel: "Declined",
                }
              : snapshot
          }
        />
      </div>
    );
  }

  return null;
}
