import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../platform/composition/public-api";

export default defineAgent({
  // BYOK OpenAI-compatible models do not support gateway.exa_search.
  defaultTools: false,
  model: platformDynamicModel(),
});
