import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../platform/composition/public-api";

export default defineAgent({
  model: platformDynamicModel(),
});
