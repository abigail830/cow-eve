import { JWT_ISSUER } from "../../domain/auth/auth.constants";

/** Matches eve `byPrincipal` scope keys for platform JWT users. */
export function memoryScopeKeyForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return JSON.stringify(["user", "jwt-hmac", JWT_ISSUER, normalized]);
}

export function toRedisKeyPart(value: string): string {
  return value.replaceAll(":", "_");
}
