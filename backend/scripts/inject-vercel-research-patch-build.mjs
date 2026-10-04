/**
 * Vercel builds each workspace member as its own service (see .vercel/output/config.json).
 * Root `npm run build` + patch runs BEFORE that service build, so research_retrieve ids stay
 * broken in production unless patch runs at the end of the eve-research buildCommand.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(BACKEND_ROOT, ".vercel", "output", "config.json");
const PATCH_SCRIPT = "scripts/patch-eve-research-workflow-id.mjs";
const MARKER = PATCH_SCRIPT;

/** From agents/research (where member build ends), backend root is ../.. */
const PATCH_SUFFIX =
  " && cd '../..' && node scripts/patch-eve-research-workflow-id.mjs";

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

  if (research.buildCommand.includes(MARKER)) {
    console.log("inject-vercel-research-patch: eve-research buildCommand already patched.");
    return;
  }

  research.buildCommand += PATCH_SUFFIX;
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(
    "inject-vercel-research-patch: appended workflow-id patch to eve-research Vercel buildCommand.",
  );
}

main();
