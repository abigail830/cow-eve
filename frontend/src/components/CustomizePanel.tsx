import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, Plus, Target } from "lucide-react";
import { IntegrationsPanel } from "./IntegrationsPanel";
import {
  ProjectListPanel,
  type ProjectListHandle,
} from "./ProjectListPanel";
import { SchedulePanel, type SchedulePanelHandle } from "./SchedulePanel";
import type { ScheduledTaskPublic } from "../lib/api";
import "./CustomizePanel.css";

export type CustomizeTab = "projects" | "schedules" | "integrations";

type Props = {
  agentId: string;
  tab: CustomizeTab;
  onTabChange: (tab: CustomizeTab) => void;
  onEnterProject: (projectId: string) => void;
  onEditProject: (projectId: string) => void;
  onOpenScheduleResult: (task: ScheduledTaskPublic, chatId: string) => void;
};

type AddAction = {
  label: string;
  icon: typeof Target;
};

function AddMenu({
  action,
  onSelect,
}: {
  action: AddAction;
  onSelect: () => void;
}) {
  const Icon = action.icon;
  return (
    <div className="customize-add-menu" role="menu">
      <button
        type="button"
        role="menuitem"
        className="customize-add-item"
        onClick={onSelect}
      >
        <Icon size={16} strokeWidth={2} aria-hidden />
        {action.label}
      </button>
    </div>
  );
}

const ADD_ACTIONS: Partial<Record<CustomizeTab, AddAction>> = {
  projects: { label: "Project", icon: Target },
  schedules: { label: "Scheduled task", icon: CalendarClock },
};

export function CustomizePanel({
  agentId,
  tab,
  onTabChange,
  onEnterProject,
  onEditProject,
  onOpenScheduleResult,
}: Props) {
  const projectRef = useRef<ProjectListHandle>(null);
  const scheduleRef = useRef<SchedulePanelHandle>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const addAction = ADD_ACTIONS[tab];

  useEffect(() => {
    setMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!addRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function runAdd() {
    setMenuOpen(false);
    if (tab === "projects") projectRef.current?.openCreate();
    if (tab === "schedules") scheduleRef.current?.openCreate();
  }

  return (
    <div className="customize-page">
      <header className="customize-page-header">
        <h2 className="page-title">Customize</h2>
        <div className="customize-toolbar">
          <div className="page-tabs" role="tablist" aria-label="Customize">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "projects"}
              className={tab === "projects" ? "page-tab active" : "page-tab"}
              onClick={() => onTabChange("projects")}
            >
              Projects
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "schedules"}
              className={tab === "schedules" ? "page-tab active" : "page-tab"}
              onClick={() => onTabChange("schedules")}
            >
              Schedules
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "integrations"}
              className={
                tab === "integrations" ? "page-tab active" : "page-tab"
              }
              onClick={() => onTabChange("integrations")}
            >
              Integrations
            </button>
          </div>
          {addAction ? (
            <div className="customize-add" ref={addRef}>
              <button
                type="button"
                className="customize-add-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                Add
                <ChevronDown size={14} strokeWidth={2} aria-hidden />
              </button>
              {menuOpen ? (
                <AddMenu action={addAction} onSelect={runAdd} />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <div className="customize-page-body">
        {tab === "projects" ? (
          <ProjectListPanel
            ref={projectRef}
            agentId={agentId}
            showCreateButton={false}
            onEnterProject={onEnterProject}
            onEditProject={onEditProject}
          />
        ) : tab === "schedules" ? (
          <SchedulePanel
            ref={scheduleRef}
            agentId={agentId}
            showCreateButton={false}
            onOpenResultChat={(chatId, task) =>
              onOpenScheduleResult(task, chatId)
            }
          />
        ) : (
          <IntegrationsPanel agentId={agentId} embedded />
        )}
      </div>
    </div>
  );
}
