import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";

import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "../../domain/auth/auth.constants";
import { getJwtSecret } from "../../infrastructure/config/env.config";
import {
  PLATFORM_ACCESS_TOKEN_ATTR,
  platformRouteAuth,
} from "./platform-auth.adapter.js";

test("platformRouteAuth maps login JWT to principalType user", async () => {
  const secret = new TextEncoder().encode(getJwtSecret());
  const token = await new SignJWT({ name: "Test User" })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject("test@example.com")
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  const [loginAuth] = platformRouteAuth();
  const session = await loginAuth!(
    new Request("http://127.0.0.1:2000/eve/v1/session", {
      headers: { authorization: `Bearer ${token}` },
    }),
  );

  assert.ok(session);
  assert.equal(session.principalType, "user");
  assert.match(session.principalId, /test@example.com/);
  assert.equal(session.attributes?.[PLATFORM_ACCESS_TOKEN_ATTR], token);
});
