import { eveChannel } from "eve/channels/eve";
import {
  platformCors,
  platformRouteAuth,
} from "../../../../platform/composition/public-api";

export default eveChannel({
  auth: platformRouteAuth(),
  cors: platformCors(),
  // Accept forwarded principals from omni (defineRemoteAgent forwardPrincipal).
  // Tighten this predicate before production multi-tenant use.
  trustedForwarders: () => true,
});
