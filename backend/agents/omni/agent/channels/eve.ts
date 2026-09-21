import type { ChannelReceiveContext } from "eve/channels";
import type { SessionAuthContext } from "eve/context";
import { eveChannel } from "eve/channels/eve";
import type { UserContent } from "ai";
import {
  platformCors,
  platformRouteAuth,
} from "../../../../platform/composition/public-api";

const channel = eveChannel({
  auth: platformRouteAuth(),
  cors: platformCors(),
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
