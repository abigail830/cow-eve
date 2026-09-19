import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Writable platform data root (artifacts, local settings fallback). */
export function getPlatformDataDir(): string {
  const configured = process.env.PLATFORM_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(backendRoot, "platform", "data");
}
