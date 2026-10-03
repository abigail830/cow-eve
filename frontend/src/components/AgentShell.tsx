import { Menu } from "lucide-react";
import { type ComponentProps, type ReactNode } from "react";
import { useCompactNav } from "../hooks/useCompactNav";
import { AgentNav } from "./AgentNav";

type NavProps = ComponentProps<typeof AgentNav>;

type Props = {
  nav: Omit<NavProps, "drawer" | "drawerOpen" | "onDrawerClose"> | null;
  children: ReactNode;
};

export function AgentShell({ nav, children }: Props) {
  const { compact, open, openNav, closeNav } = useCompactNav();

  return (
    <div className={compact ? "agent-shell compact" : "agent-shell"}>
      {nav ? (
        <AgentNav
          {...nav}
          drawer={compact}
          drawerOpen={open}
          onDrawerClose={closeNav}
        />
      ) : compact ? null : (
        <aside className="agent-nav agent-nav-loading" aria-hidden />
      )}
      {compact && open ? (
        <button
          type="button"
          className="agent-nav-backdrop"
          aria-label="Close navigation"
          onClick={closeNav}
        />
      ) : null}
      <main className="agent-main">
        {compact ? (
          <button
            type="button"
            className="agent-nav-open"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={openNav}
          >
            <Menu size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {children}
      </main>
    </div>
  );
}
