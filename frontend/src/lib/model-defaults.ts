import type { ModelPreset, ModelReasoning, ModelSettingsPublic } from "./api";

/** Keep in sync with backend MODEL_PRESETS / DEFAULT_SETTINGS. */
export const DEFAULT_MODEL_PRESETS: ModelPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek Flash",
    displayName: "DeepSeek Flash",
    baseURL: "https://api.deepseek.com/v1",
    modelId: "deepseek-flash",
    contextWindowTokens: 128_000,
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner (legacy)",
    displayName: "DeepSeek Reasoner",
    baseURL: "https://api.deepseek.com/v1",
    modelId: "deepseek-reasoner",
    contextWindowTokens: 128_000,
  },
  {
    id: "qwen-plus",
    label: "Qwen Plus (DashScope)",
    displayName: "Qwen Plus",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen-plus",
    contextWindowTokens: 128_000,
  },
  {
    id: "qwen-max",
    label: "Qwen Max (DashScope)",
    displayName: "Qwen Max",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen-max",
    contextWindowTokens: 128_000,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    displayName: "Custom",
    baseURL: "",
    modelId: "",
    contextWindowTokens: 128_000,
  },
];

export const DEFAULT_MODEL_SETTINGS: ModelSettingsPublic = {
  presetId: "deepseek",
  displayName: "DeepSeek Flash",
  baseURL: "https://api.deepseek.com/v1",
  modelId: "deepseek-flash",
  contextWindowTokens: 128_000,
  reasoning: "provider-default" as ModelReasoning,
  hasApiKey: false,
  apiKeyHint: null,
  updatedAt: null,
};
