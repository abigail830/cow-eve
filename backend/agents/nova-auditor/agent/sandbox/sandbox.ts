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
    "mkdir -p /workspace/audit",
    `export NODE_PATH=${quotedPath}`,
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
