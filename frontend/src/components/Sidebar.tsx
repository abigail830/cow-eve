import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { AgentCategory, AgentInfo } from "../lib/api";
import "./Sidebar.css";

type Props = {
  agents: AgentInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const AGENT_GROUPS: { category: AgentCategory; label: string }[] = [
  { category: "omni", label: "Omni Agent" },
  { category: "domain", label: "Domain Agent" },
];

function AgentButton({
  agent,
  selected,
  collapsed,
  onSelect,
}: {
  agent: AgentInfo;
  selected: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "agent-item active" : "agent-item"}
      title={agent.displayName}
      onClick={() => onSelect(agent.id)}
    >
      <img src={agent.avatar} alt="" width={32} height={32} />
      {!collapsed ? (
        <span className="agent-item-text">
          <span className="agent-item-name">{agent.displayName}</span>
          <span className="agent-item-desc">{agent.description}</span>
        </span>
      ) : null}
    </button>
  );
}

export function Sidebar({ agents, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <nav className="agent-list">
        {AGENT_GROUPS.map((group) => {
          const groupAgents = agents.filter(
            (a) =>
              a.category === group.category ||
              (a.category === undefined &&
                ((group.category === "omni" && a.id === "omni") ||
                  (group.category === "domain" && a.id !== "omni"))),
          );
          if (groupAgents.length === 0) return null;

          return (
            <section key={group.category} className="agent-group">
              {!collapsed ? (
                <h3 className="agent-group-label">{group.label}</h3>
              ) : null}
              <div className="agent-group-items">
                {groupAgents.map((agent) => (
                  <AgentButton
                    key={agent.id}
                    agent={agent}
                    selected={agent.id === selectedId}
                    collapsed={collapsed}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-collapse-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={2} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={2} />
          )}
        </button>
      </div>
    </aside>
  );
}
