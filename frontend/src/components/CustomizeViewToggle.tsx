import { LayoutGrid, List } from "lucide-react";
import type { CustomizeResourceViewMode } from "../lib/customize-view-mode";
import "./CustomizeViewToggle.css";

type Props = {
  value: CustomizeResourceViewMode;
  onChange: (mode: CustomizeResourceViewMode) => void;
  /** Accessible label for the control group */
  label?: string;
};

export function CustomizeViewToggle({
  value,
  onChange,
  label = "Browse layout",
}: Props) {
  return (
    <div
      className="customize-view-toggle"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={
          value === "card"
            ? "customize-view-toggle-btn active"
            : "customize-view-toggle-btn"
        }
        aria-pressed={value === "card"}
        title="Card view"
        onClick={() => onChange("card")}
      >
        <LayoutGrid size={16} strokeWidth={2} aria-hidden />
        <span className="customize-view-toggle-label">Cards</span>
      </button>
      <button
        type="button"
        className={
          value === "list"
            ? "customize-view-toggle-btn active"
            : "customize-view-toggle-btn"
        }
        aria-pressed={value === "list"}
        title="List view"
        onClick={() => onChange("list")}
      >
        <List size={16} strokeWidth={2} aria-hidden />
        <span className="customize-view-toggle-label">List</span>
      </button>
    </div>
  );
}
