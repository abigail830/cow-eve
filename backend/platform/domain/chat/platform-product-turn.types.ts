import type { PersistableEvent } from "./stream-event.types.js";

/** Identifiers for platform-authored product turns (not LLM). */
export type PlatformProductKind = "audio_transcript";

export type PlatformProductPayload = {
  product: PlatformProductKind;
  version: number;
  /** Stable id for idempotency (e.g. audio capture id). */
  instanceId: string;
  title: string;
};

export type PlatformProductTurnBundle = {
  turnId: string;
  events: PersistableEvent[];
};

/** @deprecated Legacy PPT user leg; new turns use {@link PLATFORM_PRODUCT_STARTED_EVENT}. */
export const PLATFORM_PRODUCT_MESSAGE_KIND = "execution.platform_product";

/** Platform-authored product turn (not a user chat message). */
export const PLATFORM_PRODUCT_STARTED_EVENT = "platform.product.started";

export type PlatformProductStartedData = {
  turnId: string;
  sequence: number;
  platform: PlatformProductPayload;
  title: string;
  parts: Array<{
    type: "file";
    filename: string;
    mediaType: string;
    size: number;
  }>;
  attachmentRefs: PlatformAttachmentRefsPayload;
};

/**
 * User-message text prefix for id-only attachment pointers (not `Client context:` —
 * that prefix triggers turn-scoped hydrate in omni). Replay exposes this to the model.
 */
export const PLATFORM_ATTACHMENT_REFS_PREFIX = "Platform attachment refs:";

export type PlatformAttachmentRefsPayload = {
  product: PlatformProductKind;
  instanceId: string;
  /** Transcript / deliverable row (e.g. output .md). */
  outputAttachmentId: string;
  /** All attachment ids for this product turn (output first, then inputs). */
  attachmentIds: string[];
};

export function formatPlatformAttachmentRefs(
  payload: PlatformAttachmentRefsPayload,
): string {
  return `${PLATFORM_ATTACHMENT_REFS_PREFIX} ${JSON.stringify(payload)}`;
}

export function platformAudioTurnId(captureId: string): string {
  return `turn_pt_audio_${captureId}`;
}
