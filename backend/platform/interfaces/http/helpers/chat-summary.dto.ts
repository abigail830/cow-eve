export type ChatOrigin = "generic" | "project" | "schedule";

export function chatOrigin(chat: {
  projectId?: string | null;
  scheduledTaskId?: string | null;
}): ChatOrigin {
  if (chat.scheduledTaskId) return "schedule";
  if (chat.projectId) return "project";
  return "generic";
}

export function toChatSummary(chat: {
  id: string;
  agentId: string;
  eveSessionId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string | null;
  scheduledTaskId?: string | null;
}) {
  return {
    id: chat.id,
    agentId: chat.agentId,
    eveSessionId: chat.eveSessionId,
    title: chat.title ?? "New chat",
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    source: chatOrigin(chat),
    projectId: chat.projectId ?? null,
    scheduledTaskId: chat.scheduledTaskId ?? null,
  };
}
