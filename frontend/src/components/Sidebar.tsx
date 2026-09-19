import type { AgentInfo } from "../lib/api";
import "./Sidebar.css";

type Props = {
  agents: AgentInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
  userName: string;
  onLogout: () => void;
  onOpenSettings: () => void;
};

export function Sidebar({
  agents,
  selectedId,
  onSelect,
  userName,
  onLogout,
  onOpenSettings,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/agents/haoyu.png" alt="" width={28} height={28} />
        <span>FDE Desk</span>
      </div>

      <div className="sidebar-section-label">AGENTS</div>
      <nav className="agent-list">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={
              agent.id === selectedId ? "agent-item active" : "agent-item"
            }
            onClick={() => onSelect(agent.id)}
          >
            <img src={agent.avatar} alt="" width={32} height={32} />
            <span>{agent.displayName}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="settings-link" onClick={onOpenSettings}>
          Settings
        </button>
        <div className="sidebar-user">
          <div className="user-avatar">{userName.slice(0, 1).toUpperCase()}</div>
          <span>{userName}</span>
        </div>
        <button type="button" className="logout-btn" onClick={onLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
