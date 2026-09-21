import type { ChannelReceiveContext } from "eve/channels";
import type { SessionAuthContext } from "eve/context";
import { eveChannel } from "eve/channels/eve";
import type { UserContent } from "ai";
import {
  platformCors,
  platformRouteAuth,
} from "../../../../platform/composition/public-api";

/** Allowed chat attachment types — mirrors platform attachment validation. */
const CHAT_ATTACHMENT_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const channel = eveChannel({
  auth: platformRouteAuth(),
  cors: platformCors(),
  uploadPolicy: {
    maxBytes: 20 * 1024 * 1024,
    allowedMediaTypes: CHAT_ATTACHMENT_MEDIA_TYPES,
  },
});

/** Proactive schedule dispatch — each run gets a fresh session. */
export default {
  ...channel,
  receive(
    input: {
      message: string | UserContent;
      target: Readonly<Record<string, unknown>>;
      auth: SessionAuthContext | null;
    },
    { from }: ChannelReceiveContext,
  ) {
    const runToken = crypto.randomUUID();
    return from(`scheduled-run:${runToken}`).send(input.message, {
      auth: input.auth,
    });
  },
};
