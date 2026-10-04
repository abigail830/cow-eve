import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../platform/composition/public-api";

export default defineAgent({
  model: platformDynamicModel(),
  /** HubSpot and web/KB MCP live on `retrieve` only — use `research_retrieve`, not root-copy `agent`. */
  tool: false,
  compaction: {
    thresholdPercent: 0.75,
  },
});
