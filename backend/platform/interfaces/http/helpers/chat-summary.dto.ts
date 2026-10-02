export function toChatSummary(chat: {
  id: string;
  agentId: string;
  eveSessionId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: chat.id,
    agentId: chat.agentId,
    eveSessionId: chat.eveSessionId,
    title: chat.title ?? "New chat",
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}
