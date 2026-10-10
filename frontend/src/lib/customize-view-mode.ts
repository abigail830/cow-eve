export type CustomizeResourceViewMode = "card" | "list";

const STORAGE_PREFIX = "customize-view";

export function readCustomizeViewMode(
  scope: "projects" | "schedules",
): CustomizeResourceViewMode {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}-${scope}`);
    if (raw === "card" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "card";
}

export function writeCustomizeViewMode(
  scope: "projects" | "schedules",
  mode: CustomizeResourceViewMode,
): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${scope}`, mode);
  } catch {
    /* ignore */
  }
}
