import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeOAuthState,
  createOAuthState,
  generateCodeChallenge,
  generateCodeVerifier,
} from "./pkce.js";

describe("integration oauth pkce", () => {
  it("round-trips signed state", () => {
    const key = "test-signing-key-min-16";
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    assert.ok(challenge.length > 10);
    const state = createOAuthState({
      userId: "user-1",
      provider: "notion",
      codeVerifier: verifier,
      signingKey: key,
      agentId: "omni",
    });
    const pending = consumeOAuthState(state, key);
    assert.ok(pending);
    assert.equal(pending.userId, "user-1");
    assert.equal(pending.provider, "notion");
    assert.equal(pending.codeVerifier, verifier);
    assert.equal(pending.agentId, "omni");
  });

  it("rejects tampered state", () => {
    const key = "test-signing-key-min-16";
    const state = createOAuthState({
      userId: "user-1",
      provider: "notion",
      codeVerifier: generateCodeVerifier(),
      signingKey: key,
    });
    const parts = state.split(".");
    const tampered = `${parts[0]}.${parts[1]}.invalid-signature`;
    assert.equal(consumeOAuthState(tampered, key), null);
  });
});
