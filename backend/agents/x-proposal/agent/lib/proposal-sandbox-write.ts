import type { SandboxSession } from "eve/sandbox";

function shellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function writeSandboxTextFile(
  sandbox: SandboxSession,
  filePath: string,
  content: string,
): Promise<void> {
  const dir = filePath.replace(/\/[^/]+$/, "");
  const b64 = Buffer.from(content, "utf8").toString("base64");
  const cmd = [
    "set -e",
    `mkdir -p ${shellSingleQuoted(dir)}`,
    `printf '%s' ${shellSingleQuoted(b64)} | base64 -d > ${shellSingleQuoted(filePath)}`,
  ].join("\n");
  const result = await sandbox.run({ command: cmd });
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || `Failed to write ${filePath} (exit ${result.exitCode})`,
    );
  }
}
