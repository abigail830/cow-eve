import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withEve } from "eve/vercel";

/**
 * Agent-only workspace: eve contributes eve-omni + eve-content-studio.
 * Custom platform channel routes (/api/*) are not on /eve/<agent>/v1 — publish
 * them explicitly onto the omni service.
 *
 * Vercel compiles this file to `backend/.vercel/vercel-temp.mjs`, so
 * `import.meta.url` is under `.vercel/` — walk up to the real workspace root.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = basename(here) === ".vercel" ? dirname(here) : here;

export default await withEve(
  {
    routes: [
      // Canonical platform API
      {
        src: "^/api(?:/(.*))?$",
        destination: { type: "service", service: "eve-omni" },
      },
      // Compat: frontend mistakenly using VITE_API_URL=.../eve/omni
      {
        src: "^/eve/omni/api(?:/(.*))?$",
        destination: { type: "service", service: "eve-omni" },
        transforms: [
          {
            type: "request.path",
            op: "set",
            args: "/api/$1",
          },
        ],
      },
    ],
  },
  { root },
);
