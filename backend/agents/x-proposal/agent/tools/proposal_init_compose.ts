import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBlueprint, loadGraph } from "../lib/blueprint-loader.js";
import {
  CLIENT_PATH,
  META_PATH,
  PROPOSAL_DIR,
  QUOTATION_PATH,
} from "../lib/proposal-paths.js";
import { writeSandboxTextFile } from "../lib/proposal-sandbox-write.js";

export default defineTool({
  description:
    "Initialize Compose IR under /workspace/proposal for a Proposal Blueprint (meta, empty client/quotation, graph summary).",
  inputSchema: z.object({
    blueprintId: z
      .string()
      .min(1)
      .describe(
        "Proposal Blueprint id from proposal_list_blueprints (e.g. acorp-sg-sme-abs)",
      ),
    outputFormat: z
      .enum(["docx", "pptx", "html", "markdown"])
      .optional()
      .describe("Override blueprint default output format"),
    tier: z.enum(["A", "B", "C"]).optional(),
  }),
  async execute({ blueprintId, outputFormat, tier }, ctx) {
    const blueprint = loadBlueprint(blueprintId);
    const graph = loadGraph(blueprint.compose.graph);
    const sandbox = await ctx.getSandbox();

    const meta = {
      blueprintId: blueprint.id,
      businessUnit: blueprint.catalog.businessUnit,
      sosMode: blueprint.compose.sosMode,
      quotationLayout: blueprint.compose.quotationLayout,
      tier: tier ?? blueprint.defaults.tier,
      outputFormat: outputFormat ?? blueprint.output.defaultFormat,
      enabledExtensions: [...blueprint.defaults.extensions],
      graphId: graph.id,
      letterEntity: blueprint.letterEntity ?? null,
      initializedAt: new Date().toISOString(),
    };

    const client = {
      company_name: null,
      contact_name: null,
      contact_email: null,
      contact_title: null,
      company_address: null,
      entity_jurisdiction: null,
    };

    const quotation = {
      currency: null,
      layout: blueprint.compose.quotationLayout,
      rows: [] as unknown[],
    };

    await writeSandboxTextFile(
      sandbox,
      META_PATH,
      `${JSON.stringify(meta, null, 2)}\n`,
    );
    await writeSandboxTextFile(
      sandbox,
      CLIENT_PATH,
      `${JSON.stringify(client, null, 2)}\n`,
    );
    await writeSandboxTextFile(
      sandbox,
      QUOTATION_PATH,
      `${JSON.stringify(quotation, null, 2)}\n`,
    );

    return {
      status: "ok",
      proposalDir: PROPOSAL_DIR,
      blueprint: {
        id: blueprint.id,
        displayName: blueprint.displayName,
        businessUnit: blueprint.catalog.businessUnit,
      },
      graph: {
        id: graph.id,
        displayName: graph.displayName ?? graph.id,
        sectionComponentIds: graph.sections.map((s) => s.componentId),
      },
      metaPath: META_PATH,
    };
  },
});
