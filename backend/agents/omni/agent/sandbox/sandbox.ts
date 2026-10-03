import { defineSandbox } from "eve/sandbox";
import { contentStudioEnvironment } from "./e2b-provider.js";

export const environment = contentStudioEnvironment();

const SESSION_BOOTSTRAP = [
  "set -e",
  "mkdir -p /workspace/content-studio",
  'if [ -d "$HOME/.agents/skills" ]; then',
  '  ln -sfn "$HOME/.agents/skills" /workspace/skills',
  '  ln -sfn "$HOME/.agents/skills" /workspace/content-studio/skills',
  "elif [ -d /workspace/skills ]; then",
  "  ln -sfn /workspace/skills /workspace/content-studio/skills",
  "fi",
  'if [ -d /home/user/content-studio/skills ] && [ ! -d "$HOME/.agents/skills" ]; then',
  "  ln -sfn /home/user/content-studio/skills /workspace/content-studio/skills 2>/dev/null || true",
  "fi",
].join("\n");

export default defineSandbox(async () => {
  const sandbox = await environment.open();
  const result = await sandbox.run({ command: SESSION_BOOTSTRAP });
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || `E2B session bootstrap failed (exit ${result.exitCode})`,
    );
  }
  return sandbox;
});
