import { useState, type FormEvent } from "react";
import "./Composer.css";

type Props = {
  disabled?: boolean;
  statusLabel?: string;
  onSend: (text: string) => void;
  onCancel?: () => void;
};

export function Composer({ disabled, statusLabel, onSend, onCancel }: Props) {
  const [text, setText] = useState("");

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
          rows={1}
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
            <span className="composer-icon" title="Attach (soon)">
              📎
            </span>
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
              ↑
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
