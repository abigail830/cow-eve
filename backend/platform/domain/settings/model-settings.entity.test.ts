import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  modelCatalogToStoredPayload,
  modelSettingsPayloadNeedsMigration,
  normalizeModelCatalog,
} from "./model-settings.entity.js";

describe("modelSettingsPayloadNeedsMigration", () => {
  it("flags legacy single-model payload", () => {
    assert.equal(
      modelSettingsPayloadNeedsMigration({
        presetId: "deepseek",
        displayName: "DeepSeek Flash",
        baseURL: "https://api.deepseek.com/v1",
        modelId: "deepseek-flash",
        contextWindowTokens: 1_000_000,
        reasoning: "provider-default",
        apiKeyEncrypted: null,
        updatedAt: null,
      }),
      true,
    );
  });

  it("flags catalog rows with deprecated qwen-plus preset", () => {
    assert.equal(
      modelSettingsPayloadNeedsMigration({
        defaultId: "default",
        updatedAt: "2026-01-01T00:00:00.000Z",
        models: [
          {
            id: "default",
            presetId: "qwen-plus",
            displayName: "Qwen Plus",
            baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            modelId: "qwen-plus",
            contextWindowTokens: 128_000,
            reasoning: "provider-default",
            apiKeyEncrypted: null,
          },
        ],
      }),
      true,
    );
  });

  it("accepts canonical catalog payload", () => {
    const catalog = normalizeModelCatalog({
      defaultId: "default",
      models: [
        {
          id: "default",
          presetId: "deepseek",
          displayName: "DeepSeek Flash",
          baseURL: "https://api.deepseek.com/v1",
          modelId: "deepseek-flash",
          contextWindowTokens: 1_000_000,
          reasoning: "provider-default",
          apiKeyEncrypted: null,
        },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const stored = modelCatalogToStoredPayload(catalog);
    assert.equal(modelSettingsPayloadNeedsMigration(stored), false);
  });
});
