import { eveChannel } from "eve/channels/eve";
import {
  platformCors,
  platformRouteAuth,
} from "../../../../platform/composition/public-api";

export default eveChannel({
  auth: platformRouteAuth(),
  cors: platformCors(),
});
