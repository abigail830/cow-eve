import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function packageName(dir: string): string | null {
  try {
    const pkg = JSON.parse(
      readFileSync(join(dir, "package.json"), "utf8"),
    ) as { name?: string };
    return pkg.name ?? null;
  } catch {
    return null;
  }
}

/** Repo backend/ root (package name `cow-eve-backend`), for paths like agents/ and platform/data/. */
export function findBackendRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (packageName(dir) === "cow-eve-backend") return dir;
    const nestedBackend = join(dir, "backend");
    if (
      existsSync(join(nestedBackend, "package.json")) &&
      packageName(nestedBackend) === "cow-eve-backend"
    ) {
      return nestedBackend;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
