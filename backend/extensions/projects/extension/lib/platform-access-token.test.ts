import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_ACCESS_TOKEN_ATTR,
  readPlatformAccessToken,
} from "./platform-access-token.js";

test("readPlatformAccessToken reads platform JWT from auth.current", () => {
  const token = readPlatformAccessToken({
    session: {
      auth: {
        current: {
          principalType: "user",
          attributes: { [PLATFORM_ACCESS_TOKEN_ATTR]: "jwt-user" },
        },
      },
    },
  });
  assert.equal(token, "jwt-user");
});

test("readPlatformAccessToken rejects non-user principals", () => {
  const token = readPlatformAccessToken({
    session: {
      auth: {
        current: { principalType: "service", attributes: {} },
      },
    },
  });
  assert.equal(token, null);
});
