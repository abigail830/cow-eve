import { useEffect, useRef, useState } from "react";
import { Check, Home, LogOut, Settings, User } from "lucide-react";
import type { AgentInfo } from "../lib/api";
import { AgentDisplayName } from "../lib/agentDisplayName";
import "./UserAccountMenu.css";

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

type Props = {
  userName: string;
  userEmail: string;
  compact?: boolean;
  /** Home header: outline user icon + name only */
  minimal?: boolean;
  /** Where the menu opens relative to the trigger (agent nav footer uses above). */
  menuPlacement?: "above" | "below";
  /** Agent nav: name/email already shown on the trigger. */
  showAccountMeta?: boolean;
  onGoHome?: () => void;
  switchAgents?: {
    agents: readonly AgentInfo[];
    currentAgentId: string;
    onSelect: (agentId: string) => void;
  };
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function UserAccountMenu({
  userName,
  userEmail,
  compact = false,
  minimal = false,
  menuPlacement = "below",
  showAccountMeta = true,
  onGoHome,
  switchAgents,
  onOpenSettings,
  onLogout,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  return (
    <div
      className={[
        "user-account-menu",
        compact ? "compact" : "",
        minimal ? "minimal" : "",
        menuPlacement === "above"
          ? "user-account-menu--placement-above"
          : "user-account-menu--placement-below",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={menuRef}
    >
      <button
        type="button"
        className="user-account-trigger"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {minimal ? (
          <>
            <User size={18} strokeWidth={1.75} aria-hidden className="user-account-icon" />
            <span className="user-account-name-minimal">{userName}</span>
          </>
        ) : (
          <>
            <span className="user-account-avatar">{userInitials(userName)}</span>
            {!compact ? (
              <span className="user-account-label">
                <span className="user-account-name">{userName}</span>
                <span className="user-account-email">{userEmail}</span>
              </span>
            ) : null}
          </>
        )}
      </button>

      {menuOpen ? (
        <div className="user-account-dropdown" role="menu">
          {showAccountMeta ? (
            <>
              <div className="user-account-dropdown-meta">
                <strong>{userName}</strong>
                <span>{userEmail}</span>
              </div>
              <div className="user-account-dropdown-divider" />
            </>
          ) : null}
          {onGoHome ? (
            <button
              type="button"
              className="user-account-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onGoHome();
              }}
            >
              <Home size={16} strokeWidth={2} aria-hidden />
              Home
            </button>
          ) : null}
          {switchAgents && switchAgents.agents.length > 0 ? (
            <>
              {onGoHome ? (
                <div className="user-account-dropdown-divider" />
              ) : null}
              <div className="user-account-dropdown-section" role="presentation">
                Switch agent
              </div>
              <ul className="user-account-agent-list" role="group">
                {switchAgents.agents.map((agent) => {
                  const isCurrent =
                    agent.id === switchAgents.currentAgentId;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        className={[
                          "user-account-dropdown-item",
                          "user-account-dropdown-item--agent",
                          isCurrent
                            ? "user-account-dropdown-item--current"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        role="menuitem"
                        aria-current={isCurrent ? "true" : undefined}
                        disabled={isCurrent}
                        onClick={() => {
                          if (isCurrent) return;
                          setMenuOpen(false);
                          switchAgents.onSelect(agent.id);
                        }}
                      >
                        <img
                          src={agent.avatar}
                          alt=""
                          width={24}
                          height={24}
                          className="user-account-agent-avatar"
                        />
                        <AgentDisplayName
                          displayName={agent.displayName}
                          className="user-account-agent-name"
                          highlightClassName="user-account-agent-name-highlight"
                        />
                        {isCurrent ? (
                          <Check
                            size={16}
                            strokeWidth={2}
                            aria-hidden
                            className="user-account-agent-current-icon"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          <div className="user-account-dropdown-divider" />
          <button
            type="button"
            className="user-account-dropdown-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
          >
            <Settings size={16} strokeWidth={2} aria-hidden />
            Settings
          </button>
          <button
            type="button"
            className="user-account-dropdown-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
