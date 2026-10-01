import type { MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";

/** Legacy PPT user leg (message.received). */
export const PLATFORM_PRODUCT_MESSAGE_KIND = "execution.platform_product";

export const PLATFORM_PRODUCT_STARTED_EVENT = "platform.product.started";

export type PlatformAudioTranscriptTurn = {
  product: "audio_transcript";
  instanceId: string;
  turnId: string;
  title: string;
};

type StreamEventPayload = MessageStreamEvent & {
  data?: Record<string, unknown>;
};

function parseAudioTurnFromEvent(event: MessageStreamEvent): PlatformAudioTranscriptTurn | null {
  const raw = event as StreamEventPayload;
  if ((raw.type as string) === PLATFORM_PRODUCT_STARTED_EVENT) {
    const data = raw.data as {
      turnId?: string;
      platform?: {
        product?: string;
        instanceId?: string;
        title?: string;
      };
      title?: string;
    };
    if (data.platform?.product !== "audio_transcript") return null;
    if (!data.platform.instanceId || !data.turnId) return null;
    return {
      product: "audio_transcript",
      instanceId: data.platform.instanceId,
      turnId: data.turnId,
      title: data.platform.title ?? data.title ?? "Audio transcript",
    };
  }

  if (event.type !== "message.received") return null;
  const data = event.data as {
    kind?: string;
    turnId?: string;
    platform?: {
      product?: string;
      instanceId?: string;
      title?: string;
    };
  };
  if (data.kind !== PLATFORM_PRODUCT_MESSAGE_KIND) return null;
  if (data.platform?.product !== "audio_transcript") return null;
  if (!data.platform.instanceId || !data.turnId) return null;
  return {
    product: "audio_transcript",
    instanceId: data.platform.instanceId,
    turnId: data.turnId,
    title: data.platform.title ?? "Audio transcript",
  };
}

export function extractPlatformAudioTurns(
  events: readonly MessageStreamEvent[] | undefined,
): PlatformAudioTranscriptTurn[] {
  if (!events?.length) return [];
  const byInstance = new Map<string, PlatformAudioTranscriptTurn>();
  for (const event of events) {
    const turn = parseAudioTurnFromEvent(event);
    if (!turn) continue;
    byInstance.set(turn.instanceId, turn);
  }
  return [...byInstance.values()];
}

export function platformTurnIdsFromEvents(
  events: readonly MessageStreamEvent[] | undefined,
): Set<string> {
  return new Set(extractPlatformAudioTurns(events).map((t) => t.turnId));
}

/** Hide reducer-projected rows for legacy PPT user legs only. */
export function isPlatformProductTurnMessage(
  message: EveMessage,
  platformTurnIds: Set<string>,
): boolean {
  const turnId = message.metadata?.turnId;
  return Boolean(turnId && platformTurnIds.has(turnId));
}

export function captureIdsInPlatformStream(
  events: readonly MessageStreamEvent[] | undefined,
): Set<string> {
  return new Set(extractPlatformAudioTurns(events).map((t) => t.instanceId));
}

export type TimelineMessageRow = {
  type: "message";
  message: EveMessage;
  extraAttachmentIds: string[];
  extraWorkspaceFileIds: string[];
};

export type TimelinePlatformAudioRow = {
  type: "platform_audio";
  captureId: string;
  turnId: string;
};

export type ChatTimelineRow = TimelineMessageRow | TimelinePlatformAudioRow;

function platformTurnEventIndex(
  events: readonly MessageStreamEvent[],
  turn: PlatformAudioTranscriptTurn,
): number {
  const started = events.findIndex((event) => {
    const raw = event as StreamEventPayload;
    if ((raw.type as string) !== PLATFORM_PRODUCT_STARTED_EVENT) return false;
    const data = raw.data as {
      turnId?: string;
      platform?: { instanceId?: string };
    };
    return (
      data.turnId === turn.turnId &&
      data.platform?.instanceId === turn.instanceId
    );
  });
  if (started >= 0) return started;

  return events.findIndex((event) => {
    if (event.type !== "message.received") return false;
    const data = event.data as {
      kind?: string;
      turnId?: string;
      platform?: { instanceId?: string };
    };
    return (
      data.kind === PLATFORM_PRODUCT_MESSAGE_KIND &&
      data.turnId === turn.turnId &&
      data.platform?.instanceId === turn.instanceId
    );
  });
}

function messageEventIndex(
  events: readonly MessageStreamEvent[],
  message: EveMessage,
): number {
  const byId = events.findIndex((event) => event.meta?.id === message.id);
  if (byId >= 0) return byId;

  const turnId = message.metadata?.turnId;
  if (!turnId) return -1;

  if (message.role === "user") {
    return events.findIndex((event) => {
      if (event.type !== "message.received") return false;
      const data = event.data as { turnId?: string; kind?: string };
      if (data.kind === PLATFORM_PRODUCT_MESSAGE_KIND) return false;
      return data.turnId === turnId;
    });
  }

  if (message.role === "assistant") {
    const completed = events.findIndex((event) => {
      if (event.type !== "message.completed") return false;
      const data = event.data as { turnId?: string };
      return data.turnId === turnId;
    });
    if (completed >= 0) return completed;
    return events.findIndex((event) => {
      if (event.type !== "message.received") return false;
      const data = event.data as { turnId?: string };
      return data.turnId === turnId;
    });
  }

  return -1;
}

/** Live socket + DB-bound events (PPT may exist only on bound until reload). */
export function mergeStreamEventsForTimeline(
  live: readonly MessageStreamEvent[],
  persisted: readonly MessageStreamEvent[],
): readonly MessageStreamEvent[] {
  if (!persisted.length) return live;
  if (!live.length) return persisted;

  const liveIds = new Set(
    live.map((e) => e.meta?.id).filter((id): id is string => Boolean(id)),
  );
  const merged: MessageStreamEvent[] = [...live];

  for (const event of persisted) {
    const id = event.meta?.id;
    if (!id || liveIds.has(id)) continue;

    const at = event.meta?.at ? Date.parse(String(event.meta.at)) : Number.NaN;
    let insertAt = merged.length;
    if (!Number.isNaN(at)) {
      for (let i = 0; i < merged.length; i++) {
        const otherAt = merged[i].meta?.at
          ? Date.parse(String(merged[i].meta!.at))
          : Number.NaN;
        if (!Number.isNaN(otherAt) && at < otherAt) {
          insertAt = i;
          break;
        }
      }
    }
    merged.splice(insertAt, 0, event);
    liveIds.add(id);
  }

  return merged;
}

function sortKeyForMessageSlot(
  events: readonly MessageStreamEvent[],
  message: EveMessage,
  displayIndex: number,
  visibleCount: number,
): number {
  const idx = messageEventIndex(events, message);
  if (idx >= 0) return idx;
  // Live turns not yet in events — keep chronological tail order after known stream rows.
  return Number.MAX_SAFE_INTEGER - (visibleCount - 1 - displayIndex);
}

/** Interleave Eve messages with platform product turns using stream event order. */
export function buildChatTimeline(input: {
  displayMessages: Array<{
    message: EveMessage;
    extraAttachmentIds: string[];
    extraWorkspaceFileIds: string[];
  }>;
  events: readonly MessageStreamEvent[] | undefined;
}): ChatTimelineRow[] {
  const { displayMessages, events } = input;
  const platformTurnIds = platformTurnIdsFromEvents(events);
  const visible = displayMessages.filter(
    ({ message }) => !isPlatformProductTurnMessage(message, platformTurnIds),
  );

  const platforms = extractPlatformAudioTurns(events);
  if (!events?.length || platforms.length === 0) {
    return visible.map((row) => ({
      type: "message",
      message: row.message,
      extraAttachmentIds: row.extraAttachmentIds,
      extraWorkspaceFileIds: row.extraWorkspaceFileIds,
    }));
  }

  const platformSlots = platforms
    .map((turn) => ({
      turn,
      eventIdx: platformTurnEventIndex(events, turn),
    }))
    .filter((row) => row.eventIdx >= 0)
    .sort((a, b) => a.eventIdx - b.eventIdx);

  const messageSlots = visible.map((row, displayIndex) => ({
    row,
    eventIdx: sortKeyForMessageSlot(
      events,
      row.message,
      displayIndex,
      visible.length,
    ),
  }));

  let p = 0;
  let m = 0;
  const out: ChatTimelineRow[] = [];

  while (m < messageSlots.length || p < platformSlots.length) {
    const nextPlatform = platformSlots[p];
    const nextMessage = messageSlots[m];
    const usePlatform =
      nextPlatform &&
      (m >= messageSlots.length ||
        (nextMessage.eventIdx >= 0 &&
          nextPlatform.eventIdx <= nextMessage.eventIdx));

    if (usePlatform) {
      out.push({
        type: "platform_audio",
        captureId: nextPlatform.turn.instanceId,
        turnId: nextPlatform.turn.turnId,
      });
      p += 1;
    } else if (m < messageSlots.length) {
      out.push({
        type: "message",
        message: nextMessage.row.message,
        extraAttachmentIds: nextMessage.row.extraAttachmentIds,
        extraWorkspaceFileIds: nextMessage.row.extraWorkspaceFileIds,
      });
      m += 1;
    } else {
      break;
    }
  }

  return out;
}
