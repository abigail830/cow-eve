import { Sandbox } from "e2b";
import { e2b } from "@e2b/eve-sandbox";
import { defineSandbox } from "eve/sandbox";
import type { SandboxBackend, SandboxBackendHandle } from "eve/sandbox";

function existingTemplate(): string {
  return process.env.E2B_CONTENT_STUDIO_TEMPLATE?.trim() || "okf-content-studio";
}

async function sandboxIdOf(handle: {
  captureState: SandboxBackendHandle["captureState"];
}): Promise<string | null> {
  const id = (await handle.captureState()).metadata.sandboxId;
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * Start the already-built E2B template. Do not snapshot or rebuild it:
 * `okf-content-studio` is the image, and a session is just a new VM from that image.
 * Session-only setup belongs in `onSession`, not in template prewarm.
 */
function readAutoPause(): boolean {
  const raw = process.env.E2B_AUTO_PAUSE?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  // Default false: if turn-end pause fails, E2B timeout kills instead of pausing.
  return false;
}

function contentStudioBackend(): SandboxBackend {
  const inner = e2b({
    template: existingTemplate(),
    autoPause: readAutoPause(),
  });
  return {
    name: inner.name,
    async prewarm() {
      return { reused: true };
    },
    async create(input) {
      const handle = await inner.create({ ...input, templateKey: null });
      return {
        ...handle,
        async stop() {
          const id = await sandboxIdOf(handle);
          if (!id) return;
          // Filesystem-only pause: workspace files persist; eve reconnects via
          // Sandbox.connect on the next turn. Cheaper than keeping memory hot
          // until the 30-minute E2B auto-pause timeout.
          await Sandbox.pause(id, { keepMemory: false });
        },
        async delete() {
          const id = await sandboxIdOf(handle);
          if (id) await Sandbox.kill(id);
        },
        async shutdown() {
          await handle.shutdown();
        },
      };
    },
  };
}

export default defineSandbox({
  backend: () => contentStudioBackend(),
  async onSession({ use }) {
    const sandbox = await use();
    await sandbox.run({
      command:
        "mkdir -p /workspace/content-studio && ln -sfn /workspace/skills /workspace/content-studio/skills 2>/dev/null || true",
    });
  },
});
