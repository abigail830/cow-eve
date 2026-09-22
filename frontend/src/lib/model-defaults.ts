import type {
  ModelCatalogPublic,
  ModelPreset,
  ModelReasoning,
  ModelSettingsPublic,
} from "./api";

/** Keep in sync with backend CONTEXT_WINDOW_OPTIONS / MODEL_PRESETS. */
export const CONTEXT_WINDOW_OPTIONS = [
  { label: "128K", value: 131_072 },
  { label: "256K", value: 262_144 },
  { label: "512K", value: 524_288 },
  { label: "1M", value: 1_000_000 },
] as const;

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 1_000_000;

/** Keep in sync with backend MODEL_PRESETS / DEFAULT_SETTINGS. */
export const DEFAULT_MODEL_PRESETS: ModelPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek Flash",
    displayName: "DeepSeek Flash",
    baseURL: "https://api.deepseek.com/v1",
    modelId: "deepseek-flash",
    contextWindowTokens: 1_000_000,
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner (legacy)",
    displayName: "DeepSeek Reasoner",
    baseURL: "https://api.deepseek.com/v1",
    modelId: "deepseek-reasoner",
    contextWindowTokens: 131_072,
  },
  {
    id: "qwen3.7-plus",
    label: "Qwen 3.7 Plus (DashScope)",
    displayName: "Qwen 3.7 Plus",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen3.7-plus",
    contextWindowTokens: 1_000_000,
  },
  {
    id: "qwen3-max",
    label: "Qwen 3 Max (DashScope)",
    displayName: "Qwen 3 Max",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen3-max",
    contextWindowTokens: 262_144,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    displayName: "Custom",
    baseURL: "",
    modelId: "",
    contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
  },
];

export const DEFAULT_MODEL_SETTINGS: ModelSettingsPublic = {
  presetId: "deepseek",
  displayName: "DeepSeek Flash",
  baseURL: "https://api.deepseek.com/v1",
  modelId: "deepseek-flash",
  contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
  reasoning: "provider-default" as ModelReasoning,
  hasApiKey: false,
  apiKeyHint: null,
  updatedAt: null,
};

export function formatContextWindowLabel(tokens: number): string {
  const match = CONTEXT_WINDOW_OPTIONS.find((option) => option.value === tokens);
  if (match) return match.label;
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

export function catalogFromSettings(
  settings: ModelSettingsPublic,
  id = "default",
): ModelCatalogPublic {
  return {
    defaultId: id,
    updatedAt: settings.updatedAt,
    models: [
      {
        id,
        presetId: settings.presetId,
        displayName: settings.displayName,
        baseURL: settings.baseURL,
        modelId: settings.modelId,
        contextWindowTokens: settings.contextWindowTokens,
        reasoning: settings.reasoning,
        hasApiKey: settings.hasApiKey,
        apiKeyHint: settings.apiKeyHint,
      },
    ],
  };
}

/** PUT /api/settings/model may return legacy `{ settings }` without `catalog`. */
export function resolveSavedCatalog(
  res: { catalog?: ModelCatalogPublic; settings: ModelSettingsPublic },
  sentModelCount: number,
): ModelCatalogPublic {
  if (res.catalog?.models?.length) return res.catalog;
  if (sentModelCount > 1) {
    throw new Error(
      "Backend did not accept the multi-model catalog. Redeploy cow-eve backend to the latest version, then retry.",
    );
  }
  return catalogFromSettings(res.settings);
}
