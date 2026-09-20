import { defineTool } from "eve/tools";
import { z } from "zod";

/** Replaces Eve's default Exa/Gateway web_search (unsupported on BYOK models). */
export default defineTool({
  description:
    "Disabled. Use MCP tools hybrid-search_hybrid_search or zhipu-web-search_web_search_prime instead.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  async execute() {
    return {
      status: "error",
      message:
        "Built-in web search is disabled. Use hybrid-search or zhipu-web-search MCP tools.",
    };
  },
});
