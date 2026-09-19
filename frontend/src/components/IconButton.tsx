import type { LucideIcon } from "lucide-react";
import "./IconButton.css";

type Props = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  bare?: boolean;
  size?: number;
  className?: string;
};

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  bare = false,
  size = 22,
  className = "",
}: Props) {
  return (
    <button
      type="button"
      className={`icon-btn ${bare ? "bare" : ""} ${active ? "active" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={size} strokeWidth={2} aria-hidden />
    </button>
  );
}
