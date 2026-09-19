import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import "./AppHeader.css";

type ModuleId = "agent-team";

type Props = {
  activeModule: ModuleId;
  userName: string;
  userEmail: string;
  onOpenSettings: () => void;
  onLogout: () => void;
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

const MODULES: { id: ModuleId; label: string }[] = [
  { id: "agent-team", label: "Agent Team" },
];

export function AppHeader({
  activeModule,
  userName,
  userEmail,
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
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-brand">
          <img src="/agents/bodha-brand.png" alt="" width={28} height={28} />
          <span className="app-brand-name">FDE-DESK</span>
        </div>

        <nav className="app-module-nav" aria-label="Modules">
          {MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              className={
                module.id === activeModule
                  ? "app-module-item active"
                  : "app-module-item"
              }
              aria-current={module.id === activeModule ? "page" : undefined}
            >
              {module.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="app-header-right">
        <button
          type="button"
          className="app-header-icon-btn"
          aria-label="Settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={18} strokeWidth={2} />
        </button>

        <div className="app-header-user" ref={menuRef}>
          <button
            type="button"
            className="app-header-avatar"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {userInitials(userName)}
          </button>

          {menuOpen ? (
            <div className="app-header-menu" role="menu">
              <div className="app-header-menu-meta">
                <strong>{userName}</strong>
                <span>{userEmail}</span>
              </div>
              <div className="app-header-menu-divider" />
              <button
                type="button"
                className="app-header-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                }}
              >
                <Settings size={16} strokeWidth={2} />
                Settings
              </button>
              <button
                type="button"
                className="app-header-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={16} strokeWidth={2} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
