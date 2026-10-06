import { useMemo, useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Target,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  fetchChats,
  fetchScheduleSummary,
  scheduleTaskLabel,
  type ChatSummary,
  type ScheduledTaskPublic,
} from "../lib/api";
import { fetchProjectSummary, type ProjectPublic } from "../lib/projects";
import "./WorkHubCards.css";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

function formatRecentTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type WorkFilter = "all" | "chat" | "projects" | "schedules";

type WorkRecentKind = "chat" | "project" | "schedule";

type WorkRecentItem = {
  kind: WorkRecentKind;
  id: string;
  title: string;
  at: string;
  meta?: string;
  chatId?: string;
  projectId?: string;
  task?: ScheduledTaskPublic;
};

/** Max rows shown in Recent (All merge or per-tab lists). */
const RECENT_LIMIT = 8;
/** Projects / schedules fetched before per-entity chat lookups. */
const FETCH_LIMIT = 10;

function RecentKindIcon({ kind }: { kind: WorkRecentKind }) {
  const props = { size: 14, strokeWidth: 2, "aria-hidden": true as const };
  if (kind === "chat") return <MessageSquare {...props} />;
  if (kind === "project") return <Target {...props} />;
  return <CalendarClock {...props} />;
}

function chatSessionTitle(chat: ChatSummary): string {
  return chat.title?.trim() || "Chat";
}

function buildGenericItem(chat: ChatSummary): WorkRecentItem {
  return {
    kind: "chat",
    id: `chat-${chat.id}`,
    title: chatSessionTitle(chat),
    at: chat.updatedAt,
    chatId: chat.id,
  };
}

function buildProjectChatItem(
  chat: ChatSummary,
  projectName: string,
): WorkRecentItem {
  const name = projectName.trim() || "Project";
  return {
    kind: "project",
    id: `project-chat-${chat.id}`,
    title: `Project – ${name} : ${chatSessionTitle(chat)}`,
    at: chat.updatedAt,
    chatId: chat.id,
    projectId: chat.projectId ?? undefined,
  };
}

function buildScheduleChatItem(
  chat: ChatSummary,
  task: ScheduledTaskPublic,
): WorkRecentItem {
  return {
    kind: "schedule",
    id: `schedule-chat-${chat.id}`,
    title: `${scheduleTaskLabel(task)} : ${chatSessionTitle(chat)}`,
    at: chat.updatedAt,
    chatId: chat.id,
    task,
  };
}

function buildSchedulePlaceholder(task: ScheduledTaskPublic): WorkRecentItem {
  return {
    kind: "schedule",
    id: `schedule-empty-${task.id}`,
    title: scheduleTaskLabel(task),
    at: task.updatedAt,
    meta: "Not run yet",
    task,
  };
}

function sortAndLimit(items: WorkRecentItem[]): WorkRecentItem[] {
  return [...items]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, RECENT_LIMIT);
}

type Props = {
  agentId: string;
  onOpenSchedules: () => void;
  onOpenProjects: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenScheduleResult: (task: ScheduledTaskPublic) => void;
  onEnterProject: (projectId: string) => void;
};

export function WorkHubCards({
  agentId,
  onOpenSchedules,
  onOpenProjects,
  onOpenChat,
  onOpenScheduleResult,
  onEnterProject,
}: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<WorkFilter>("all");
  const greeting = useMemo(() => {
    const hello = greetingForHour(new Date().getHours());
    const name = user?.displayName ? firstName(user.displayName) : "";
    return name ? `${hello}, ${name}` : hello;
  }, [user?.displayName]);
  const [schedules, setSchedules] = useState<ScheduledTaskPublic[]>([]);
  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [genericChats, setGenericChats] = useState<ChatSummary[]>([]);
  const [projectChats, setProjectChats] = useState<ChatSummary[]>([]);
  const [scheduleItems, setScheduleItems] = useState<WorkRecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedRes, projList, genericRes] = await Promise.all([
        fetchScheduleSummary(agentId, FETCH_LIMIT),
        fetchProjectSummary(agentId, FETCH_LIMIT),
        fetchChats(agentId, { scope: "generic" }),
      ]);
      setSchedules(schedRes.schedules);
      setProjects(projList);
      setGenericChats(genericRes.chats);

      const projectChatGroups = await Promise.all(
        projList.map((project) =>
          fetchChats(agentId, { scope: "project", projectId: project.id }),
        ),
      );
      const flatProjectChats = projectChatGroups.flatMap((res) => res.chats);
      setProjectChats(flatProjectChats);

      const scheduleChatGroups = await Promise.all(
        schedRes.schedules.map((task) =>
          fetchChats(agentId, { scope: "schedule", scheduleId: task.id }),
        ),
      );

      const scheduleRows: WorkRecentItem[] = [];
      schedRes.schedules.forEach((task, index) => {
        const chats = scheduleChatGroups[index]?.chats ?? [];
        if (chats.length > 0) {
          for (const chat of chats) {
            scheduleRows.push(buildScheduleChatItem(chat, task));
          }
        } else {
          scheduleRows.push(buildSchedulePlaceholder(task));
        }
      });
      setScheduleItems(scheduleRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load work hub");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const genericItems = useMemo(
    () => genericChats.map(buildGenericItem),
    [genericChats],
  );

  const projectItems = useMemo(
    () =>
      projectChats.map((chat) =>
        buildProjectChatItem(
          chat,
          chat.projectId
            ? (projectNameById.get(chat.projectId) ?? "Project")
            : "Project",
        ),
      ),
    [projectChats, projectNameById],
  );

  const allItems = useMemo(
    () => sortAndLimit([...genericItems, ...projectItems, ...scheduleItems]),
    [genericItems, projectItems, scheduleItems],
  );

  const visibleItems = useMemo(() => {
    if (filter === "all") return allItems;
    if (filter === "chat") return sortAndLimit(genericItems);
    if (filter === "projects") return sortAndLimit(projectItems);
    return sortAndLimit(scheduleItems);
  }, [filter, allItems, genericItems, projectItems, scheduleItems]);

  function handleRecentClick(item: WorkRecentItem) {
    if (item.chatId) {
      onOpenChat(item.chatId);
      return;
    }
    if (item.task) {
      onOpenScheduleResult(item.task);
      return;
    }
    if (item.projectId) {
      onEnterProject(item.projectId);
    }
  }

  function emptyCopy(): string {
    switch (filter) {
      case "chat":
        return "No chats yet. Message below to start.";
      case "projects":
        return "No project conversations yet.";
      case "schedules":
        return "No scheduled tasks yet.";
      default:
        return "Nothing recent yet. Message below, or create a project or schedule.";
    }
  }

  if (loading) {
    return (
      <div className="work-hub-state-center" role="status">
        <Loader2 size={22} className="work-hub-spin" aria-hidden />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="work-hub">
      {error ? (
        <p className="work-hub-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="work-hub-top">
        <header className="work-hub-intro">
          <h2 className="work-hub-greeting">{greeting}</h2>
          <p className="work-hub-hint">
            Pick up recent work below, or message to start a chat.
          </p>
        </header>

        <div
          className="work-hub-mode-strip"
          role="tablist"
          aria-label="Work modes"
        >
          {(
            [
              {
                value: "all" as const,
                label: "All",
                meta: "Recent work",
                icon: LayoutGrid,
              },
              {
                value: "chat" as const,
                label: "Chat",
                meta: "Message below",
                icon: MessageSquare,
              },
              {
                value: "projects" as const,
                label: "Projects",
                meta:
                  projects.length === 0
                    ? "None yet"
                    : `${projects.length} active`,
                icon: Target,
              },
              {
                value: "schedules" as const,
                label: "Schedules",
                meta:
                  schedules.length === 0
                    ? "None yet"
                    : `${schedules.length} task${schedules.length === 1 ? "" : "s"}`,
                icon: CalendarClock,
              },
            ] as const
          ).map(({ value, label, meta, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              className={
                filter === value
                  ? "work-hub-mode-tile is-active"
                  : "work-hub-mode-tile"
              }
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
            >
              <span className="work-hub-mode-tile-head">
                <Icon size={16} strokeWidth={2} aria-hidden />
                <span className="work-hub-mode-tile-title">{label}</span>
              </span>
              <span className="work-hub-mode-tile-meta">{meta}</span>
            </button>
          ))}
        </div>

        {filter === "projects" ? (
          <div className="work-hub-view-all-row">
            <button
              type="button"
              className="work-hub-view-all"
              onClick={onOpenProjects}
            >
              View all projects
            </button>
          </div>
        ) : null}
        {filter === "schedules" ? (
          <div className="work-hub-view-all-row">
            <button
              type="button"
              className="work-hub-view-all"
              onClick={onOpenSchedules}
            >
              View all schedules
            </button>
          </div>
        ) : null}
      </div>

      <div className="work-hub-recent-scroll">
        <section className="work-hub-recent" aria-label="Recent work">
          {visibleItems.length === 0 ? (
            <p className="work-hub-empty">{emptyCopy()}</p>
          ) : (
            <ul className="work-hub-recent-list">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="work-hub-recent-row"
                    onClick={() => handleRecentClick(item)}
                  >
                    <span className="work-hub-recent-kind">
                      <RecentKindIcon kind={item.kind} />
                    </span>
                    <span className="work-hub-recent-title">{item.title}</span>
                    <span className="work-hub-recent-meta">
                      {item.meta ?? formatRecentTime(item.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
