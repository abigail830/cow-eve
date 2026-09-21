import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../../../platform/composition/public-api.js";

export default defineAgent({
  defaultTools: false,
  model: platformDynamicModel(),
});
