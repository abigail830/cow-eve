import { defineTool } from "eve/tools";
import { z } from "zod";

/** Replaces Eve's default Exa/Gateway web_search (unsupported on BYOK models). */
export default defineTool({
  description:
    "Disabled. Use the zhipu-web-search MCP tools for web retrieval when needed.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  async execute() {
    return {
      status: "error",
      message:
        "Built-in web search is disabled. Use zhipu-web-search_web_search_prime when web retrieval is needed.",
    };
  },
});
