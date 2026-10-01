import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
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
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function UserAccountMenu({
  userName,
  userEmail,
  compact = false,
  minimal = false,
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
          <div className="user-account-dropdown-meta">
            <strong>{userName}</strong>
            <span>{userEmail}</span>
          </div>
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
