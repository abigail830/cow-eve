export type Chat = {
  id: string;
  userId: string;
  agentId: string;
  eveSessionId: string;
  /** Eve session stream cursor; must match persisted event count for resume. */
  eveStreamIndex: number;
  title: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatEvent = {
  id: string;
  chatId: string;
  type: string;
  payload: unknown;
  emittedAt: Date;
};

export type ChatWithEvents = Chat & { events: ChatEvent[] };
