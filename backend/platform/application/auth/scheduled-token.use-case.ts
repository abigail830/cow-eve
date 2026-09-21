import type { SessionAuthContext } from "eve/context";
import {
  JWT_ISSUER,
} from "../../domain/auth/auth.constants";

/** Build session auth for proactive schedule dispatch (matches JWT principal shape). */
export function mintScheduledRunAuth(
  userId: string,
  attributes: Record<string, string> = {},
): SessionAuthContext {
  const subject = userId.includes(":") ? userId.split(":").slice(1).join(":") : userId;
  return {
    authenticator: "jwt-hmac",
    issuer: JWT_ISSUER,
    principalId: userId.includes(":") ? userId : `${JWT_ISSUER}:${userId}`,
    principalType: "user",
    subject,
    attributes,
  };
}
