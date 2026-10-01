export type ThemeId = "asc" | "arql";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
};

export const THEME_STORAGE_KEY = "cow-eve.color-theme";

export const COLOR_THEMES: readonly ThemeDefinition[] = [
  {
    id: "asc",
    name: "ASC",
    description: "Orange accent · light surfaces",
  },
  {
    id: "arql",
    name: "ARQL",
    description: "Teal accent · slate rail",
  },
] as const;

const DEFAULT_THEME: ThemeId = "asc";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return COLOR_THEMES.some((theme) => theme.id === value);
}

function normalizeStoredThemeId(raw: string | null): ThemeId | null {
  if (raw === "arrl") return "arql";
  if (isThemeId(raw)) return raw;
  return null;
}

export function getStoredThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const id = normalizeStoredThemeId(raw);
    if (id) {
      if (raw === "arrl") {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, "arql");
        } catch {
          /* ignore */
        }
      }
      return id;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyThemeId(themeId: ThemeId): void {
  document.documentElement.setAttribute("data-theme", themeId);
}

export function setStoredThemeId(themeId: ThemeId): void {
  applyThemeId(themeId);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    /* ignore */
  }
}

export function initThemeFromStorage(): ThemeId {
  const id = getStoredThemeId();
  applyThemeId(id);
  return id;
}
