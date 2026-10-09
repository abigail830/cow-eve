/** Feishu Open Platform REST helpers (user access token). */

export class FeishuApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FeishuApiError";
  }
}

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

async function request(
  accessToken: string,
  method: string,
  apiBase: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${apiBase.replace(/\/$/, "")}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, { method, headers: headers(accessToken) });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FeishuApiError("invalid_json", response.statusText || "Invalid Feishu response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FeishuApiError("invalid_json", "Feishu response was not a JSON object");
  }
  const record = payload as Record<string, unknown>;
  if (response.status >= 400) {
    throw new FeishuApiError(
      "http_error",
      String(record.msg ?? response.statusText ?? response.status),
    );
  }
  if (record.code !== 0 && record.code !== undefined && record.code !== null) {
    throw new FeishuApiError("feishu_error", String(record.msg ?? record.code));
  }
  const data = record.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function messageText(raw: Record<string, unknown>): string {
  const body = raw.body;
  const bodyObj =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const contentRaw =
    typeof bodyObj.content === "string"
      ? bodyObj.content
      : typeof raw.content === "string"
        ? raw.content
        : "";
  if (!contentRaw.trim()) return "";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const text = (parsed as Record<string, unknown>).text;
      if (typeof text === "string") return text.slice(0, 1000);
    }
  } catch {
    return contentRaw.slice(0, 500);
  }
  return contentRaw.slice(0, 500);
}

function summarizeMessage(raw: Record<string, unknown>): Record<string, unknown> {
  const sender = raw.sender;
  const senderObj =
    sender && typeof sender === "object" && !Array.isArray(sender)
      ? (sender as Record<string, unknown>)
      : {};
  const createTime = raw.create_time;
  let createdAt: string | null = null;
  if (typeof createTime === "string" && /^\d+$/.test(createTime)) {
    createdAt = new Date(Number(createTime) / 1000).toISOString();
  }
  return {
    message_id: raw.message_id ?? null,
    chat_id: raw.chat_id ?? null,
    msg_type: raw.msg_type ?? null,
    sender_id: senderObj.id ?? null,
    created_at: createdAt,
    text: messageText(raw),
  };
}

export async function listChats(
  accessToken: string,
  input: { apiBase: string; pageSize?: number },
): Promise<Array<Record<string, unknown>>> {
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 20, 50));
  const data = await request(accessToken, "GET", input.apiBase, "/open-apis/im/v1/chats", {
    page_size: pageSize,
  });
  const items = data.items;
  if (!Array.isArray(items)) return [];
  const chats: Array<Record<string, unknown>> = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    chats.push({
      chat_id: row.chat_id ?? null,
      name: row.name ?? null,
      chat_type: row.chat_type ?? null,
      description: row.description ?? null,
    });
  }
  return chats;
}

export async function listMessages(
  accessToken: string,
  input: { apiBase: string; chatId: string; pageSize?: number },
): Promise<Array<Record<string, unknown>>> {
  const chatId = input.chatId.trim();
  if (!chatId) throw new FeishuApiError("invalid_chat_id", "chat_id is required");
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 20, 50));
  const data = await request(accessToken, "GET", input.apiBase, "/open-apis/im/v1/messages", {
    container_id_type: "chat",
    container_id: chatId,
    page_size: pageSize,
  });
  const items = data.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => summarizeMessage(item));
}

export async function getDocRawContent(
  accessToken: string,
  input: { apiBase: string; documentId: string },
): Promise<{ document_id: string; content: string }> {
  const documentId = input.documentId.trim();
  if (!documentId) {
    throw new FeishuApiError("invalid_document_id", "document_id is required");
  }
  const data = await request(
    accessToken,
    "GET",
    input.apiBase,
    `/open-apis/docx/v1/documents/${documentId}/raw_content`,
  );
  let content = String(data.content ?? "");
  if (content.length > 12_000) {
    content = `${content.slice(0, 12_000)}\n… [truncated]`;
  }
  return { document_id: documentId, content };
}

export async function listCalendarEvents(
  accessToken: string,
  input: { apiBase: string; daysAhead?: number; pageSize?: number },
): Promise<Record<string, unknown>> {
  const calendarsData = await request(
    accessToken,
    "GET",
    input.apiBase,
    "/open-apis/calendar/v4/calendars",
    { page_size: 50 },
  );
  const calendarList = calendarsData.calendar_list;
  const list = Array.isArray(calendarList) ? calendarList : [];
  let calendarId: string | null = null;
  let calendarName: string | null = null;
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.type === "primary") {
      calendarId = typeof row.calendar_id === "string" ? row.calendar_id : null;
      calendarName = typeof row.summary === "string" ? row.summary : null;
      break;
    }
  }
  if (!calendarId && list[0] && typeof list[0] === "object" && !Array.isArray(list[0])) {
    const first = list[0] as Record<string, unknown>;
    calendarId = typeof first.calendar_id === "string" ? first.calendar_id : null;
    calendarName = typeof first.summary === "string" ? first.summary : null;
  }
  if (!calendarId) {
    throw new FeishuApiError("no_calendar", "No Feishu calendar found for this user");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const daysAhead = Math.max(1, Math.min(input.daysAhead ?? 7, 30));
  const endSec = nowSec + daysAhead * 86400;
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 20, 50));
  const eventsData = await request(
    accessToken,
    "GET",
    input.apiBase,
    `/open-apis/calendar/v4/calendars/${calendarId}/events`,
    {
      start_time: String(nowSec),
      end_time: String(endSec),
      page_size: pageSize,
    },
  );
  const items = eventsData.items;
  const events: Array<Record<string, unknown>> = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const start = row.start;
      const end = row.end;
      const startObj =
        start && typeof start === "object" && !Array.isArray(start)
          ? (start as Record<string, unknown>)
          : {};
      const endObj =
        end && typeof end === "object" && !Array.isArray(end)
          ? (end as Record<string, unknown>)
          : {};
      const description = String(row.description ?? "");
      events.push({
        event_id: row.event_id ?? null,
        summary: row.summary ?? null,
        description: description.slice(0, 500) || null,
        start: startObj.date_time ?? startObj.date ?? null,
        end: endObj.date_time ?? endObj.date ?? null,
        status: row.status ?? null,
      });
    }
  }
  return {
    calendar_id: calendarId,
    calendar_name: calendarName,
    count: events.length,
    events,
  };
}
