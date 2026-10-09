import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFeishuAuthorizeUrl,
  feishuDocumentIdFromUrl,
  isFeishuOAuthConfigured,
} from "./feishu.js";
import { getOAuthIntegrationHandler } from "../integration-oauth-registry.js";

describe("Feishu integration provider", () => {
  it("is registered for OAuth", () => {
    const handler = getOAuthIntegrationHandler("feishu");
    assert.ok(handler);
    assert.equal(handler.id, "feishu");
  });

  it("buildAuthorizeUrl uses Feishu accounts host and scope", () => {
    const prev = {
      id: process.env.FEISHU_APP_ID,
      secret: process.env.FEISHU_APP_SECRET,
      redirect: process.env.FEISHU_OAUTH_REDIRECT_URI,
    };
    process.env.FEISHU_APP_ID = "cli_test";
    process.env.FEISHU_APP_SECRET = "secret";
    process.env.FEISHU_OAUTH_REDIRECT_URI = "http://127.0.0.1:2000/api/integrations/feishu/callback";
    try {
      const url = buildFeishuAuthorizeUrl({ state: "s", codeChallenge: "unused" });
      assert.match(url, /accounts\.feishu\.cn\/open-apis\/authen\/v1\/authorize/);
      assert.match(url, /client_id=cli_test/);
      assert.match(url, /offline_access/);
      assert.equal(isFeishuOAuthConfigured(), true);
    } finally {
      process.env.FEISHU_APP_ID = prev.id;
      process.env.FEISHU_APP_SECRET = prev.secret;
      process.env.FEISHU_OAUTH_REDIRECT_URI = prev.redirect;
    }
  });

  it("parses docx URLs", () => {
    assert.equal(
      feishuDocumentIdFromUrl("https://example.feishu.cn/docx/doxcnAbCdEf123456"),
      "doxcnAbCdEf123456",
    );
  });
});
