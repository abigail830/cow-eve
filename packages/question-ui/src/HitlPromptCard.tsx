import { useMemo, useState } from "react";
import type { InputResponse } from "eve/client";
import type { EveInputRequest, PendingHitlItem } from "./collectPendingInputRequests";

type HitlOption = NonNullable<NonNullable<EveInputRequest>["options"]>[number];

export type HitlRespondedSnapshot = {
  readonly requestId: string;
  readonly optionId?: string;
  readonly text?: string;
  readonly optionLabel?: string;
};

type Props = {
  item: PendingHitlItem;
  disabled?: boolean;
  onRespond: (responses: InputResponse[]) => void | Promise<void>;
  responded?: HitlRespondedSnapshot | null;
};

function kindHeading(kind: PendingHitlItem["request"]["kind"]): string {
  switch (kind) {
    case "question":
      return "Clarification needed";
    case "tool-approval":
      return "Approval required";
    case "session-limit":
      return "Session limit";
    default:
      return "Input required";
  }
}

function toolApprovalSubtitle(toolName: string): string {
  const friendly = toolName.replace(/_/g, " ");
  return `Action: ${friendly}`;
}

export function HitlPromptCard({
  item,
  disabled = false,
  onRespond,
  responded = null,
}: Props) {
  const { request, toolName } = item;
  const options = request.options ?? [];
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    options[0]?.id ?? null,
  );
  const [freeform, setFreeform] = useState("");

  const canFreeform =
    request.allowFreeform === true ||
    options.length === 0 ||
    request.display === "text";

  const submitLabel = useMemo(() => {
    if (request.kind === "tool-approval" && request.display === "confirmation") {
      return "Confirm";
    }
    return "Submit";
  }, [request.display, request.kind]);

  if (responded) {
    const answer =
      responded.optionLabel ??
      responded.text ??
      responded.optionId ??
      "Answer recorded";
    return (
      <div className="hitl-card hitl-card--answered" role="status">
        <p className="hitl-card-kicker">{kindHeading(request.kind)}</p>
        <p className="hitl-card-prompt">{request.prompt}</p>
        <p className="hitl-card-answer">
          <span className="hitl-card-answer-label">Your answer:</span> {answer}
        </p>
      </div>
    );
  }

  async function handleSubmit(optionId?: string) {
    const responses: InputResponse[] = [];
    const trimmed = freeform.trim();
    if (optionId) {
      responses.push({ requestId: request.requestId, optionId });
    } else if (trimmed.length > 0) {
      responses.push({ requestId: request.requestId, text: trimmed });
    } else if (selectedOptionId) {
      responses.push({ requestId: request.requestId, optionId: selectedOptionId });
    } else {
      return;
    }
    await onRespond(responses);
  }

  const useOptionButtons =
    request.display === "confirmation" ||
    (request.kind === "tool-approval" && options.length > 0 && options.length <= 3);

  return (
    <div className="hitl-card" role="group" aria-labelledby={`hitl-${request.requestId}`}>
      <p className="hitl-card-kicker" id={`hitl-${request.requestId}`}>
        {kindHeading(request.kind)}
      </p>
      {request.kind === "tool-approval" ? (
        <p className="hitl-card-meta">{toolApprovalSubtitle(toolName)}</p>
      ) : null}
      <p className="hitl-card-prompt">{request.prompt}</p>

      {useOptionButtons ? (
        <div className="hitl-card-actions">
          {options.map((option: HitlOption) => (
            <button
              key={option.id}
              type="button"
              className={`hitl-btn hitl-btn--${option.style ?? "default"}`}
              disabled={disabled}
              onClick={() => void handleSubmit(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : options.length > 0 ? (
        <fieldset className="hitl-options" disabled={disabled}>
          <legend className="sr-only">Choose an option</legend>
          {options.map((option: HitlOption) => (
            <label key={option.id} className="hitl-option">
              <input
                type="radio"
                name={`hitl-${request.requestId}`}
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => setSelectedOptionId(option.id)}
              />
              <span className="hitl-option-body">
                <span className="hitl-option-label">{option.label}</span>
                {option.description ? (
                  <span className="hitl-option-desc">{option.description}</span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {canFreeform ? (
        <label className="hitl-freeform">
          <span className="hitl-freeform-label">Other answer</span>
          <textarea
            rows={2}
            value={freeform}
            disabled={disabled}
            placeholder="Type your answer…"
            onChange={(e) => setFreeform(e.target.value)}
          />
        </label>
      ) : null}

      {!useOptionButtons ? (
        <button
          type="button"
          className="hitl-btn hitl-btn--primary hitl-submit"
          disabled={disabled}
          onClick={() => void handleSubmit()}
        >
          {submitLabel}
        </button>
      ) : null}
    </div>
  );
}
