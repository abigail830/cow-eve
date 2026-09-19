import { eveChannel } from "eve/channels/eve";
import {
  platformCors,
  platformRouteAuth,
} from "../../../../platform/auth/eve-auth";

export default eveChannel({
  auth: platformRouteAuth(),
  cors: platformCors(),
});
