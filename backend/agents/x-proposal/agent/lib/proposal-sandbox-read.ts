import type { SandboxSession } from "eve/sandbox";

function shellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function readSandboxTextFile(
  sandbox: SandboxSession,
  filePath: string,
): Promise<string | null> {
  const cmd = `test -f ${shellSingleQuoted(filePath)} && cat ${shellSingleQuoted(filePath)}`;
  const result = await sandbox.run({ command: cmd });
  if (result.exitCode !== 0) {
    return null;
  }
  return result.stdout;
}
