import { defineTool } from "eve/tools";
import { z } from "zod";
import { listBlueprintSummaries } from "../lib/blueprint-loader.js";

export default defineTool({
  description:
    "List supported Proposal Blueprint ids (SG SME ABS, SG SME Rikvin, etc.) for scenario selection.",
  inputSchema: z.object({}),
  async execute() {
    const blueprints = listBlueprintSummaries();
    return { blueprints };
  },
});
