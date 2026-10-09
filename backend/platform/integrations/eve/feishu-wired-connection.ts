import { defineDynamic } from "eve/connections";

/**
 * Marks Feishu as wired for Customize → Integrations (no MCP connection).
 * API tools live under each agent's `tools/feishu_*.ts`.
 */
export default defineDynamic({
  events: {},
});
