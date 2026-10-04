import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withEve } from "eve/vercel";
import { appendResearchWorkflowPatchToBuildCommand } from "./scripts/research-workflow-patch-build-suffix.mjs";

/**
 * Agent-only workspace: eve contributes eve-omni.
 * Custom platform channel routes (/api/*) are not on /eve/<agent>/v1 — publish
 * them explicitly onto the omni service.
 *
 * Vercel compiles this file to `backend/.vercel/vercel-temp.mjs`, so
 * `import.meta.url` is under `.vercel/` — walk up to the real workspace root.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = basename(here) === ".vercel" ? dirname(here) : here;

const composed = await withEve(
  {
    routes: [
      // Canonical platform API
      {
        src: "^/api(?:/(.*))?$",
        destination: { type: "service", service: "eve-omni" },
      },
      // Parse pipeline (GHA runners + local HTTP worker): job payload, files, webhooks
      {
        src: "^/internal/parse/v1(?:/(.*))?$",
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
      {
        src: "^/eve/omni/internal/parse/v1(?:/(.*))?$",
        destination: { type: "service", service: "eve-omni" },
        transforms: [
          {
            type: "request.path",
            op: "set",
            args: "/internal/parse/v1/$1",
          },
        ],
      },
    ],
  },
  { root },
);

/** Vercel resolves vercel.ts before service builds; config.json inject during npm run build is not used. */
const services = { ...composed.services };
const eveResearch = services["eve-research"];
if (eveResearch && typeof eveResearch.buildCommand === "string") {
  services["eve-research"] = {
    ...eveResearch,
    buildCommand: appendResearchWorkflowPatchToBuildCommand(
      eveResearch.buildCommand,
    ),
  };
}

export default { ...composed, services };
