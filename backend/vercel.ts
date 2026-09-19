import { withEve } from "eve/vercel";

/**
 * Agent-only workspace: eve contributes eve-omni + eve-content-studio.
 * Custom platform channel routes (/api/*) are not on /eve/<agent>/v1 — publish
 * them explicitly onto the omni service.
 */
export default await withEve({
  routes: [
    {
      src: "^/api(?:/(.*))?$",
      destination: { type: "service", service: "eve-omni" },
    },
  ],
});
