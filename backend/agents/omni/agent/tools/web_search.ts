import { defineTool } from "eve/tools";
import { z } from "zod";

/** Replaces Eve's default Exa/Gateway web_search (unsupported on BYOK models). */
export default defineTool({
  description:
    "Disabled. Delegate research-heavy tasks to the Content Studio subagent.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  async execute() {
    return {
      status: "error",
      message:
        "Built-in web search is disabled. Delegate to Content Studio for research and deliverables.",
    };
  },
});
