import { Brain, X } from "lucide-react";
import type { UserMemorySnapshot } from "../lib/api";
import "./AgentAsidePanel.css";
import "./MemoryPanel.css";

type Props = {
  agentName: string;
  memory: UserMemorySnapshot | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function MemoryPanel({
  agentName,
  memory,
  loading,
  error,
  onClose,
}: Props) {
  return (
    <aside className="agent-aside-panel memory-panel">
        <div className="agent-aside-panel-header">
          <div className="agent-aside-panel-title">
            <Brain size={16} strokeWidth={2} aria-hidden />
            <h3>Memory</h3>
          </div>
          <button
            type="button"
            className="agent-aside-panel-close"
            aria-label="Close memory"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="agent-aside-panel-body memory-panel-body">
          {loading ? <p className="memory-muted">Loading memory…</p> : null}
          {error ? <p className="memory-error">{error}</p> : null}

          {!loading && !error ? (
            <>
              <section className="memory-section">
                <h4>Global preferences</h4>
                <p className="memory-section-hint">
                  Durable preferences shared across all agents in Agent Team.
                </p>
                {memory && memory.globalPreferences.length > 0 ? (
                  <ul className="memory-list">
                    {memory.globalPreferences.map((entry) => (
                      <li key={entry.index}>
                        <span className="memory-index">{entry.index}</span>
                        <span>{entry.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="memory-empty">No global preferences saved yet.</p>
                )}
              </section>

              <section className="memory-section">
                <h4>{agentName}</h4>
                <p className="memory-section-hint">
                  Long-term memory for this agent (facts and captured context).
                </p>
                {memory && memory.agentMemories.length > 0 ? (
                  <ul className="memory-list">
                    {memory.agentMemories.map((entry) => (
                      <li key={entry.id}>
                        <div className="memory-agent-row">
                          <span>{entry.text}</span>
                          {entry.source ? (
                            <span className="memory-tag">{entry.source}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="memory-empty">No agent memory for this user yet.</p>
                )}
              </section>
            </>
          ) : null}
        </div>
    </aside>
  );
}
