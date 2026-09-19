import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import "./Composer.css";

type Props = {
  disabled?: boolean;
  statusLabel?: string;
  onSend: (text: string) => void;
  onCancel?: () => void;
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

export function Composer({ disabled, statusLabel, onSend, onCancel }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          rows={MIN_LINES}
          placeholder="Message... (type @ to reference attachments)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
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
            <span className="model-tag">{statusLabel ?? "eve"}</span>
            {onCancel ? (
              <button type="button" className="cancel-btn" onClick={onCancel}>
                Stop
              </button>
            ) : null}
            <button
              type="submit"
              className="send-btn"
              disabled={disabled || !text.trim()}
              aria-label="Send"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
