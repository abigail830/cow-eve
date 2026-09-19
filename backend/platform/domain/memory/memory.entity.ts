export type MemoryEntry = {
  id: string;
  text: string;
  source: string | null;
  sessionId: string | null;
};

export type PreferenceEntry = {
  index: number;
  text: string;
};

export type UserMemorySnapshot = {
  globalPreferences: PreferenceEntry[];
  agentMemories: MemoryEntry[];
};
