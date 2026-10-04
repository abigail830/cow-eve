import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../../../platform/composition/public-api.js";

export default defineAgent({
  description:
    "Runs bounded web, knowledge-base, HubSpot, and workspace retrieval for one sub-question. Returns structured JSON only.",
  model: platformDynamicModel(),
  tool: false,
});
