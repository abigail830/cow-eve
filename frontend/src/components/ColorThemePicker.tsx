import { Check } from "lucide-react";
import { COLOR_THEMES, setStoredThemeId, type ThemeId } from "../lib/theme";
import "./ColorThemePicker.css";

type Props = {
  value: ThemeId;
  onChange: (next: ThemeId) => void;
};

function ThemePreviewSwatch({ themeId }: { themeId: ThemeId }) {
  return (
    <div
      className={`color-theme-swatch color-theme-swatch-${themeId}`}
      aria-hidden
    >
      <span className="color-theme-swatch-rail">
        <span className="color-theme-swatch-rail-accent" />
        <span className="color-theme-swatch-rail-line" />
        <span className="color-theme-swatch-rail-line muted" />
      </span>
      <span className="color-theme-swatch-main">
        <span className="color-theme-swatch-main-line" />
        <span className="color-theme-swatch-main-line short" />
      </span>
    </div>
  );
}

export function ColorThemePicker({ value, onChange }: Props) {
  return (
    <div className="color-theme-grid" role="radiogroup" aria-label="Color theme">
      {COLOR_THEMES.map((theme) => {
        const selected = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={
              selected ? "color-theme-card active" : "color-theme-card"
            }
            onClick={() => {
              if (selected) return;
              setStoredThemeId(theme.id);
              onChange(theme.id);
            }}
          >
            <ThemePreviewSwatch themeId={theme.id} />
            <span className="color-theme-card-text">
              <span className="color-theme-card-name">
                {theme.name}
                {selected ? (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="color-theme-card-check"
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="color-theme-card-desc">{theme.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
