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

function readAutoPause(): boolean {
  const raw = process.env.E2B_AUTO_PAUSE?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return false;
}

function studioBackend(): SandboxBackend {
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
  backend: () => studioBackend(),
  async onSession({ use }) {
    const sandbox = await use();
    await sandbox.run({
      command:
        "mkdir -p /workspace/content-studio && ln -sfn /workspace/skills /workspace/content-studio/skills 2>/dev/null || true",
    });
  },
});
