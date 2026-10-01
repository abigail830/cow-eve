import { API_URL } from "./config";
import { getToken } from "./session";

/** Persist workspace imports on a chat so agent tools can resolve ws: ids (Eve ctx.messages often lacks client context). */
export async function registerChatWorkspaceFileRefs(
  chatId: string,
  fileIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(fileIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;

  const token = getToken();
  if (!token) throw new Error("Sign in required.");

  const res = await fetch(
    `${API_URL}/api/chats/${encodeURIComponent(chatId)}/workspace-file-refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileIds: ids }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Failed to register workspace files (${res.status}).`);
  }
}
