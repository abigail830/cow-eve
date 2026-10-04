/**
 * Patches .vercel/output/config.json for local `eve build` / Build Output API workflows.
 * Production Vercel deploys using vercel.ts must patch in vercel.ts (config.json inject alone is ignored).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendResearchWorkflowPatchToBuildCommand,
  RESEARCH_WORKFLOW_PATCH_MARKER,
} from "./research-workflow-patch-build-suffix.mjs";

const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(BACKEND_ROOT, ".vercel", "output", "config.json");

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(
      "inject-vercel-research-patch: no .vercel/output/config.json (skip — run eve build first).",
    );
    return;
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  const research = config?.services?.["eve-research"];
  if (!research?.buildCommand || typeof research.buildCommand !== "string") {
    console.log("inject-vercel-research-patch: no eve-research service in config (skip).");
    return;
  }

  if (research.buildCommand.includes(RESEARCH_WORKFLOW_PATCH_MARKER)) {
    console.log("inject-vercel-research-patch: eve-research buildCommand already patched.");
    return;
  }

  research.buildCommand = appendResearchWorkflowPatchToBuildCommand(
    research.buildCommand,
  );
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(
    "inject-vercel-research-patch: appended workflow-id patch to eve-research buildCommand (config.json only).",
  );
}

main();
