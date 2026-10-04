/**
 * Eve 0.70.x (#3740): workspace member compile stamps dispatch workflow ids as
 * workflow//./agents/<agent>/agent/... while registration uses workflow//./agent/...
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESEARCH_AGENT = "research";

/** Catalog / dispatch ids (wrong) → runtime registration ids (correct). */
const WRONG_PREFIX = `workflow//./agents/${RESEARCH_AGENT}/agent/`;
const RIGHT_PREFIX = "workflow//./agent/";

const ROOTS = [
  path.join(BACKEND_ROOT, "agents", RESEARCH_AGENT, ".output"),
  path.join(BACKEND_ROOT, "agents", RESEARCH_AGENT, ".eve"),
  path.join(BACKEND_ROOT, ".eve", "vercel-services", `eve-${RESEARCH_AGENT}`),
];

const SKIP_DIR_NAMES = new Set([
  ".workflow-data",
  "traces",
  "node_modules",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    if (/\.(mjs|js|json)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function patchText(text) {
  if (!text.includes(WRONG_PREFIX)) return null;
  return text.replaceAll(WRONG_PREFIX, RIGHT_PREFIX);
}

let filesPatched = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const next = patchText(text);
    if (next === null) continue;
    fs.writeFileSync(file, next, "utf8");
    filesPatched += 1;
  }
}

if (filesPatched > 0) {
  console.log(
    `Patched research workflow ids in ${filesPatched} file(s) (${WRONG_PREFIX}* → ${RIGHT_PREFIX}*).`,
  );
} else {
  console.log("No research workflow id mismatch found (already patched or not built).");
}
