import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOAuthRedirectUri } from "./oauth-redirect-uri.js";

describe("normalizeOAuthRedirectUri", () => {
  it("upgrades http to https on vercel hosts", () => {
    assert.equal(
      normalizeOAuthRedirectUri(
        "http://cow-eve.vercel.app/api/integrations/hubspot/callback",
      ),
      "https://cow-eve.vercel.app/api/integrations/hubspot/callback",
    );
  });

  it("keeps http on loopback", () => {
    assert.equal(
      normalizeOAuthRedirectUri(
        "http://127.0.0.1:2000/api/integrations/hubspot/callback",
      ),
      "http://127.0.0.1:2000/api/integrations/hubspot/callback",
    );
  });
});
