import { defineTool } from "eve/tools";
import { z } from "zod";
import { PROPOSAL_DIR } from "../lib/proposal-paths.js";
import { writeSandboxTextFile } from "../lib/proposal-sandbox-write.js";

const AllowedRelativePath = z.union([
  z.enum([
    "meta.json",
    "client.json",
    "quotation.json",
    "executive_summary.md",
    "scope_of_services.md",
    "team.json",
  ]),
  z
    .string()
    .regex(
      /^extensions\/[a-z0-9_]+\.json$/,
      "Extension files must be extensions/<module_id>.json",
    ),
]);

export default defineTool({
  description:
    "Write or replace a Compose IR file under /workspace/proposal (JSON or markdown). For quotation.json, priced rows need oneOff/recurringAnnual/billingFrequency OR fees.amount/billing_frequency (then run extension compute — not ad hoc fee keys).",
  inputSchema: z.object({
    relativePath: AllowedRelativePath,
    content: z.string().min(1).max(500_000),
  }),
  async execute({ relativePath, content }, ctx) {
    if (relativePath.includes("..")) {
      throw new Error("Invalid path");
    }
    const fullPath = `${PROPOSAL_DIR}/${relativePath}`;
    const sandbox = await ctx.getSandbox();
    await writeSandboxTextFile(sandbox, fullPath, content);
    return { status: "ok", path: fullPath, bytes: content.length };
  },
});
