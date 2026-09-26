import { resolveChatIdForEveSession } from "#platform/composition/public-api.js";

export async function resolveChatIdForSession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<string | null> {
  return resolveChatIdForEveSession(input);
}
