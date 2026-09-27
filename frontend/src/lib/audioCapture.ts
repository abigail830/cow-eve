import { API_URL } from "./config";
import { getToken } from "./session";

export type AudioCapturePublic = {
  id: string;
  chatId: string;
  title: string;
  status: string;
  outputAttachmentId: string;
  outputAttachment: import("./attachmentUpload").ChatAttachmentPublic | null;
  parts: Array<{
    attachmentId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    sortOrder: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

async function captureFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchAudioCaptures(
  chatId: string,
): Promise<AudioCapturePublic[]> {
  const res = await captureFetch(`/api/chats/${chatId}/audio-captures`);
  const data = (await res.json()) as {
    ok?: boolean;
    captures?: AudioCapturePublic[];
  };
  if (!res.ok || !data.captures) return [];
  return data.captures;
}

export async function createAudioCaptureDraft(
  chatId: string,
  title: string,
): Promise<AudioCapturePublic> {
  const res = await captureFetch(`/api/chats/${chatId}/audio-captures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    capture?: AudioCapturePublic;
  };
  if (!res.ok || !data.capture) {
    throw new Error(data.error ?? `Create failed (${res.status})`);
  }
  return data.capture;
}

export async function uploadAudioCapturePart(
  chatId: string,
  captureId: string,
  file: File,
): Promise<AudioCapturePublic> {
  const form = new FormData();
  form.append("file", file);
  const res = await captureFetch(
    `/api/chats/${chatId}/audio-captures/${captureId}/parts`,
    { method: "POST", body: form },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    capture?: AudioCapturePublic;
  };
  if (!res.ok || !data.capture) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data.capture;
}

export async function startAudioCaptureTranscription(
  chatId: string,
  captureId: string,
): Promise<AudioCapturePublic> {
  const res = await captureFetch(
    `/api/chats/${chatId}/audio-captures/${captureId}/start`,
    { method: "POST" },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    capture?: AudioCapturePublic;
  };
  if (!res.ok || !data.capture) {
    throw new Error(data.error ?? `Start failed (${res.status})`);
  }
  return data.capture;
}

export async function retryAudioCaptureTranscription(
  chatId: string,
  captureId: string,
): Promise<AudioCapturePublic> {
  const res = await captureFetch(
    `/api/chats/${chatId}/audio-captures/${captureId}/retry`,
    { method: "POST" },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    capture?: AudioCapturePublic;
  };
  if (!res.ok || !data.capture) {
    throw new Error(data.error ?? `Retry failed (${res.status})`);
  }
  return data.capture;
}

export function transcriptDownloadUrl(chatId: string, captureId: string): string {
  return `${API_URL}/api/chats/${chatId}/audio-captures/${captureId}/transcript`;
}

export async function fetchTranscriptPreview(
  chatId: string,
  captureId: string,
): Promise<string> {
  const res = await captureFetch(
    `/api/chats/${chatId}/audio-captures/${captureId}/transcript`,
  );
  if (!res.ok) {
    throw new Error(`Transcript not ready (${res.status})`);
  }
  return res.text();
}

const AUDIO_ACCEPT = [
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".aac",
  ".ogg",
  ".opus",
  ".webm",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/m4a",
].join(",");

export { AUDIO_ACCEPT };

export function validateAudioCaptureFile(
  file: File,
  maxBytes: number,
): string | null {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const looksAudio =
    type.startsWith("audio/") ||
    /\.(mp3|wav|m4a|flac|aac|ogg|opus|webm)$/.test(name);
  if (!looksAudio) {
    return "Unsupported audio format.";
  }
  if (file.size > maxBytes) {
    return `File is too large. Max ${Math.round(maxBytes / (1024 * 1024))} MB per file.`;
  }
  return null;
}
