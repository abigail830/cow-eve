import { defineChannel } from "eve/channels";

/** Proactive entry for schedule dispatch — each run gets a fresh session. */
export default defineChannel({
  routes: [],
  receive(input, { from }) {
    const runToken = crypto.randomUUID();
    return from(`scheduled-run:${runToken}`).send(input.message, {
      auth: input.auth,
    });
  },
});
