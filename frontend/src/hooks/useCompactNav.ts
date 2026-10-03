import { useEffect, useState } from "react";

/** Keep in sync with the compact rules in Agent.css and AgentNav.css. */
export const COMPACT_NAV_QUERY = "(max-width: 960px)";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useCompactNav() {
  const compact = useMediaQuery(COMPACT_NAV_QUERY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!compact) setOpen(false);
  }, [compact]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return {
    compact,
    open,
    openNav: () => setOpen(true),
    closeNav: () => setOpen(false),
  };
}
