import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import "./Composer.css";

type Props = {
  disabled?: boolean;
  modelLabel?: string;
  /** Eve status is `submitted` or `streaming`. */
  busy?: boolean;
  /** Eve status is `resuming` — no send, no Stop. */
  resuming?: boolean;
  /** cancel() accepted; still waiting for turn.cancelled / session.waiting. */
  cancelling?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

const MIN_LINES = 2;
const MAX_LINES = 4;

function resizeTextarea(el: HTMLTextAreaElement) {
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  const minHeight = lineHeight * MIN_LINES;
  const maxHeight = lineHeight * MAX_LINES;

  el.style.height = "0px";
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, el.scrollHeight));
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

export function Composer({
  disabled = false,
  modelLabel,
  busy = false,
  resuming = false,
  cancelling = false,
  onSend,
  onStop,
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) resizeTextarea(el);
  }, []);

  useEffect(() => {
    syncHeight();
  }, [text, syncHeight]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || disabled || resuming) return;
    onSend(value);
    setText("");
  }

  // Mirror eve scaffold ComposerAction: empty + busy → Stop; draft → Send
  // (steer while busy). Resuming locks input and hides Stop.
  const hasDraft = text.trim().length > 0;
  const showStop = busy && !hasDraft && !resuming;
  const inputLocked = disabled || resuming;

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          rows={MIN_LINES}
          placeholder="Message... (type @ to reference attachments)"
          disabled={inputLocked}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            // Some IMEs fire compositionend before the confirming Enter keydown.
            // Delay clearing so that Enter confirms the candidate instead of sending.
            requestAnimationFrame(() => {
              isComposingRef.current = false;
            });
          }}
          onKeyDown={(e) => {
            const native = e.nativeEvent;
            if (
              isComposingRef.current ||
              native.isComposing ||
              native.keyCode === 229
            ) {
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <div className="composer-bar">
          <div className="composer-left">
            <button
              type="button"
              className="composer-icon-btn"
              title="Attach (soon)"
              aria-label="Attach file"
              disabled
            >
              <Paperclip size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="composer-right">
            {modelLabel ? <span className="model-tag">{modelLabel}</span> : null}
            {showStop ? (
              <button
                type="button"
                className="send-btn stop-btn"
                disabled={cancelling}
                aria-busy={cancelling}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop();
                }}
                aria-label={cancelling ? "Stopping" : "Stop"}
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn"
                disabled={inputLocked || !hasDraft}
                aria-label="Send"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
