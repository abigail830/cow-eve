import { defineSandbox } from "eve/sandbox";
import {
  contentStudioEnvironment,
  contentStudioNodePath,
} from "./e2b-provider.js";

export const environment = contentStudioEnvironment();

function shellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildSessionBootstrap(nodePath: string): string {
  const quotedPath = shellSingleQuoted(nodePath);
  return [
    "set -e",
    "mkdir -p /workspace/content-studio",
    `export NODE_PATH=${quotedPath}`,
    'install -d "$HOME/.config/eve"',
    `printf '%s\\n' "export NODE_PATH=${nodePath.replace(/"/g, '\\"')}" > "$HOME/.config/eve/content-studio-env.sh"`,
    'grep -qF content-studio-env.sh "$HOME/.bashrc" 2>/dev/null || echo \'[ -f "$HOME/.config/eve/content-studio-env.sh" ] && . "$HOME/.config/eve/content-studio-env.sh"\' >> "$HOME/.bashrc"',
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
}

const SESSION_BOOTSTRAP = buildSessionBootstrap(contentStudioNodePath());

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
