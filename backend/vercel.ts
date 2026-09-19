import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withEve } from "eve/vercel";

/**
 * Agent-only workspace: eve contributes eve-omni + eve-content-studio.
 * Custom platform channel routes (/api/*) are not on /eve/<agent>/v1 — publish
 * them explicitly onto the omni service.
 *
 * Pass `root` explicitly: on Vercel monorepos, config evaluation can start from
 * the repository root (`/vercel/path0`) while this file lives under `backend/`.
 */
const root = dirname(fileURLToPath(import.meta.url));

export default await withEve(
  {
    routes: [
      {
        src: "^/api(?:/(.*))?$",
        destination: { type: "service", service: "eve-omni" },
      },
    ],
  },
  { root },
);
