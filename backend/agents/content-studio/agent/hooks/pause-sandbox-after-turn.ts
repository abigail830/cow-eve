import { defineHook } from "eve/hooks";

/** Pause E2B compute once the session is idle and waiting for the next message. */
async function pauseSandboxWhenIdle(_event: unknown, ctx: { getSandbox: () => Promise<{ stop: () => Promise<void> }> }) {
  try {
    const sandbox = await ctx.getSandbox();
    await sandbox.stop();
  } catch (err) {
    // Do not fail the turn if pause is best-effort (e.g. sandbox never opened).
    console.warn("[pause-sandbox] stop failed", {
      error: err instanceof Error ? err.message : err,
    });
  }
}

export default defineHook({
  events: {
    "turn.completed": pauseSandboxWhenIdle,
    "turn.cancelled": pauseSandboxWhenIdle,
    "turn.failed": pauseSandboxWhenIdle,
  },
});
