import { defineChannel } from "eve/channels";
import {
  createPlatformRouteContext,
  registerPublicApiRoutes,
} from "../../../../platform/interfaces/http/register-public-api-routes.js";

const platformRouteCtx = createPlatformRouteContext();

export default defineChannel({
  routes: [...registerPublicApiRoutes(platformRouteCtx)],
});
