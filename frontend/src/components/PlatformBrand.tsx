import "./PlatformBrand.css";

type Props = {
  /** @deprecated use inline header wordmark */
  subtitle?: string;
  compact?: boolean;
  variant?: "default" | "header";
};

export function PlatformBrand({
  subtitle,
  compact = false,
  variant = "default",
}: Props) {
  const isHeader = variant === "header";

  return (
    <div
      className={[
        "platform-brand",
        compact ? "compact" : "",
        isHeader ? "header" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        src="/cow.png"
        alt=""
        width={isHeader ? 28 : compact ? 32 : 36}
        height={isHeader ? 28 : compact ? 32 : 36}
      />
      <div className="platform-brand-text">
        {isHeader ? (
          <span className="platform-brand-wordmark" aria-label="Agent Team">
            <span className="platform-brand-agent">Agent</span>
            <span className="platform-brand-team"> Team</span>
          </span>
        ) : (
          <>
            <span className="platform-brand-title">Agent Team</span>
            {subtitle && !compact ? (
              <span className="platform-brand-subtitle">{subtitle}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
