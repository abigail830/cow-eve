import { defineAgent } from "eve";
import { platformDynamicModel } from "../../../platform/models/platform-model";

export default defineAgent({
  model: platformDynamicModel(),
});
