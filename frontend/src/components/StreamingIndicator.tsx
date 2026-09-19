import "./StreamingIndicator.css";

type Props = {
  /** Dot only — for sidebar agent avatar corner. */
  variant?: "full" | "dot";
};

export function StreamingIndicator({ variant = "full" }: Props) {
  if (variant === "dot") {
    return <span className="streaming-dot" aria-label="Streaming" />;
  }

  return (
    <div className="streaming-indicator" role="status" aria-live="polite">
      <span className="streaming-dot" aria-hidden />
      <span className="streaming-label">Streaming</span>
    </div>
  );
}
