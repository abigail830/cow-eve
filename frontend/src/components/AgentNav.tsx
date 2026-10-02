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
  onOpenSettings: () => void;
  onLogout: () => void;
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
  onOpenSettings,
  onLogout,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hubExpanded, setHubExpanded] = useState(true);

  return (
    <aside className={collapsed ? "agent-nav collapsed" : "agent-nav"}>
      <div className="agent-nav-top">
        {!collapsed ? (
          <div className="agent-nav-identity">
            <img src={agent.avatar} alt="" width={44} height={44} />
            <div className="agent-nav-identity-text">
              <div className="agent-nav-agent-title">
                <span className="agent-nav-agent-title-name">
                  {agent.displayName}
                </span>
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
          onClick={() => onViewChange("work")}
        >
          <BotMessageSquare size={18} strokeWidth={2} aria-hidden />
          {!collapsed ? <span>Work</span> : null}
        </button>

        <button
          type="button"
          className={
            view === "customize"
              ? "agent-nav-item active"
              : "agent-nav-item"
          }
          title="Customize"
          onClick={() => onViewChange("customize")}
        >
          <Blocks size={18} strokeWidth={2} aria-hidden />
          {!collapsed ? <span>Customize</span> : null}
        </button>

        <button
          type="button"
          className={
            view === "artifacts" ? "agent-nav-item active" : "agent-nav-item"
          }
          title="Artifacts"
          onClick={() => onViewChange("artifacts")}
        >
          <Boxes size={18} strokeWidth={2} aria-hidden />
          {!collapsed ? <span>Artifacts</span> : null}
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
              if (!collapsed) setHubExpanded(true);
            }}
          >
            <FolderOpen size={18} strokeWidth={2} aria-hidden />
            {!collapsed ? <span>Workspace</span> : null}
          </button>

          {!collapsed && view === "workspace" ? (
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
                        onClick={() => onSelectFolder(folder.id)}
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
        {!collapsed ? (
          <UserAccountMenu
            userName={userName}
            userEmail={userEmail}
            onOpenSettings={onOpenSettings}
            onLogout={onLogout}
          />
        ) : null}
        <button
          type="button"
          className="agent-nav-collapse-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
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
