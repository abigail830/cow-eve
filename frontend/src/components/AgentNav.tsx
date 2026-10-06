import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  Blocks,
  BotMessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Boxes,
  Trash2,
} from "lucide-react";
import type { AgentInfo } from "../lib/api";
import { AgentDisplayName } from "../lib/agentDisplayName";
import type { WorkspaceFolderPublic } from "../lib/workspace";
import { StreamingIndicator } from "./StreamingIndicator";
import { UserAccountMenu } from "./UserAccountMenu";
import "./AgentNav.css";

export type AgentNavView =
  | "work"
  | "customize"
  | "workspace"
  | "artifacts";

type Props = {
  agent: AgentInfo;
  view: AgentNavView;
  onViewChange: (view: AgentNavView) => void;
  streaming?: boolean;
  workspaceFolders: readonly WorkspaceFolderPublic[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;
  userName: string;
  userEmail: string;
  agents: readonly AgentInfo[];
  onGoHome: () => void;
  onSwitchAgent: (agentId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  /** Overlay drawer on pad and phone. Labels stay visible; the rail does not consume layout width. */
  drawer?: boolean;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
};

export function AgentNav({
  agent,
  view,
  onViewChange,
  streaming = false,
  workspaceFolders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  userName,
  userEmail,
  agents,
  onGoHome,
  onSwitchAgent,
  onOpenSettings,
  onLogout,
  drawer = false,
  drawerOpen = false,
  onDrawerClose,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hubExpanded, setHubExpanded] = useState(true);
  const expanded = drawer || !collapsed;

  function chooseView(next: AgentNavView) {
    onViewChange(next);
    if (drawer) onDrawerClose?.();
  }

  function chooseFolder(folderId: string) {
    onSelectFolder(folderId);
    if (drawer) onDrawerClose?.();
  }

  return (
    <aside
      className={[
        "agent-nav",
        !drawer && collapsed ? "collapsed" : "",
        drawer ? "drawer" : "",
        drawer && drawerOpen ? "drawer-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={drawer && !drawerOpen ? true : undefined}
      inert={drawer && !drawerOpen ? true : undefined}
    >
      <div className="agent-nav-top">
        {expanded ? (
          <div className="agent-nav-identity">
            <img src={agent.avatar} alt="" width={44} height={44} />
            <div className="agent-nav-identity-text">
              <div className="agent-nav-agent-title">
                <AgentDisplayName
                  displayName={agent.displayName}
                  className="agent-nav-agent-title-name"
                  highlightClassName="agent-nav-agent-title-name-highlight"
                />
                {streaming ? (
                  <span className="agent-nav-streaming-inline">
                    <StreamingIndicator variant="dot" />
                    Working…
                  </span>
                ) : null}
              </div>
              <Link to="/" className="agent-nav-home-link">
                All agents
              </Link>
            </div>
          </div>
        ) : (
          <Link
            to="/"
            className="agent-nav-identity-collapsed"
            title={agent.displayName}
          >
            <img src={agent.avatar} alt="" width={32} height={32} />
          </Link>
        )}
      </div>

      <nav className="agent-nav-menu" aria-label="Agent navigation">
        <button
          type="button"
          className={
            view === "work" ? "agent-nav-item active" : "agent-nav-item"
          }
          title="Work"
          onClick={() => chooseView("work")}
        >
          <BotMessageSquare size={18} strokeWidth={2} aria-hidden />
          {expanded ? <span>Work</span> : null}
        </button>

        <button
          type="button"
          className={
            view === "customize"
              ? "agent-nav-item active"
              : "agent-nav-item"
          }
          title="Customize"
          onClick={() => chooseView("customize")}
        >
          <Blocks size={18} strokeWidth={2} aria-hidden />
          {expanded ? <span>Customize</span> : null}
        </button>

        <button
          type="button"
          className={
            view === "artifacts" ? "agent-nav-item active" : "agent-nav-item"
          }
          title="Artifacts"
          onClick={() => chooseView("artifacts")}
        >
          <Boxes size={18} strokeWidth={2} aria-hidden />
          {expanded ? <span>Artifacts</span> : null}
        </button>

        <div className="agent-nav-hub">
          <button
            type="button"
            className={
              view === "workspace"
                ? "agent-nav-item active"
                : "agent-nav-item"
            }
            title="Workspace"
            onClick={() => {
              onViewChange("workspace");
              if (expanded) setHubExpanded(true);
              if (drawer && selectedFolderId) onDrawerClose?.();
            }}
          >
            <FolderOpen size={18} strokeWidth={2} aria-hidden />
            {expanded ? <span>Workspace</span> : null}
          </button>

          {expanded && view === "workspace" ? (
            <div className="agent-nav-folders-block">
              <div className="agent-nav-folders-header">
                <button
                  type="button"
                  className="agent-nav-folders-toggle"
                  onClick={() => setHubExpanded((v) => !v)}
                >
                  <span
                    className={
                      hubExpanded
                        ? "agent-nav-chevron expanded"
                        : "agent-nav-chevron"
                    }
                    aria-hidden
                  >
                    ›
                  </span>
                  Folders
                </button>
                <div className="agent-nav-folders-tools">
                  {selectedFolderId ? (
                    <>
                      <button
                        type="button"
                        className="agent-nav-icon-btn"
                        aria-label="Rename folder"
                        title="Rename folder"
                        onClick={onRenameFolder}
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="agent-nav-icon-btn agent-nav-icon-btn-danger"
                        aria-label="Delete folder"
                        title="Delete empty folder"
                        onClick={onDeleteFolder}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="agent-nav-icon-btn"
                    aria-label="New folder"
                    title="New folder"
                    onClick={onCreateFolder}
                  >
                    <Plus size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              {hubExpanded ? (
                <div className="agent-nav-folders">
                  {workspaceFolders.length === 0 ? (
                    <p className="agent-nav-folders-empty">No folders yet.</p>
                  ) : (
                    workspaceFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className={
                          folder.id === selectedFolderId
                            ? "agent-nav-folder active"
                            : "agent-nav-folder"
                        }
                        onClick={() => chooseFolder(folder.id)}
                      >
                        <FolderOpen size={14} strokeWidth={2} aria-hidden />
                        <span>{folder.name}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      <div className="agent-nav-footer">
        <UserAccountMenu
          compact={!expanded}
          menuPlacement="above"
          showAccountMeta={false}
          userName={userName}
          userEmail={userEmail}
          onGoHome={() => {
            onGoHome();
            if (drawer) onDrawerClose?.();
          }}
          switchAgents={{
            agents,
            currentAgentId: agent.id,
            onSelect: (agentId) => {
              onSwitchAgent(agentId);
              if (drawer) onDrawerClose?.();
            },
          }}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
        <button
          type="button"
          className="agent-nav-collapse-btn"
          aria-label={
            drawer
              ? "Close navigation"
              : collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
          }
          title={
            drawer
              ? "Close navigation"
              : collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
          }
          onClick={() => {
            if (drawer) onDrawerClose?.();
            else setCollapsed((v) => !v);
          }}
        >
          {drawer || !collapsed ? (
            <PanelLeftClose size={18} strokeWidth={2} />
          ) : (
            <PanelLeftOpen size={18} strokeWidth={2} />
          )}
        </button>
      </div>
    </aside>
  );
}
