import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import "./MessageCopyButton.css";

type Props = {
  text: string;
  align?: "left" | "right";
  variant?: "default" | "onUserBubble";
};

export function MessageCopyButton({
  text,
  align = "left",
  variant = "default",
}: Props) {
  const trimmed = text.trim();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }, [trimmed]);

  if (!trimmed) return null;

  return (
    <div
      className={[
        "msg-copy-bar",
        align === "right" ? "msg-copy-bar-right" : "msg-copy-bar-left",
        variant === "onUserBubble" ? "msg-copy-bar-on-user" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="msg-copy-btn"
        onClick={() => void handleCopy()}
        aria-label={copied ? "Copied to clipboard" : "Copy message"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <Check size={14} strokeWidth={2} aria-hidden />
        ) : (
          <Copy size={14} strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  );
}
