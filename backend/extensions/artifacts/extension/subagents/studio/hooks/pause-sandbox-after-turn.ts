import { defineHook } from "eve/hooks";

async function pauseSandboxWhenIdle(
  _event: unknown,
  ctx: { getSandbox: () => Promise<{ stop: () => Promise<void> }> },
) {
  try {
    const sandbox = await ctx.getSandbox();
    await sandbox.stop();
  } catch (err) {
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
