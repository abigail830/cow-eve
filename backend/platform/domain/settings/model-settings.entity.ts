export type ModelReasoning =
  | "provider-default"
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type ModelSettings = {
  /** Preset id for UI (deepseek / qwen / custom) */
  presetId: string;
  /** Display label shown in the chat composer */
  displayName: string;
  /** OpenAI-compatible base URL, e.g. https://api.deepseek.com/v1 */
  baseURL: string;
  /** Provider model id, e.g. deepseek-flash / qwen-plus */
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  /** AES-GCM ciphertext of the API key; never return raw to clients */
  apiKeyEncrypted: string | null;
  updatedAt: string | null;
};

export type ModelSettingsPublic = Omit<ModelSettings, "apiKeyEncrypted"> & {
  hasApiKey: boolean;
  apiKeyHint: string | null;
};

export type ModelSettingsUpdate = {
  presetId?: string;
  displayName?: string;
  baseURL?: string;
  modelId?: string;
  contextWindowTokens?: number;
  reasoning?: ModelReasoning;
  /** Omit or empty string to keep existing key */
  apiKey?: string;
};

export type ModelPreset = {
  id: string;
  label: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
};

export const MODEL_PRESETS: readonly ModelPreset[] = [
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

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  presetId: "deepseek",
  displayName: "DeepSeek Flash",
  baseURL: "https://api.deepseek.com/v1",
  modelId: "deepseek-flash",
  contextWindowTokens: 128_000,
  reasoning: "provider-default",
  apiKeyEncrypted: null,
  updatedAt: null,
};

export function normalizeModelSettings(
  raw: Partial<ModelSettings> | null | undefined,
): ModelSettings {
  return {
    ...DEFAULT_MODEL_SETTINGS,
    ...raw,
    apiKeyEncrypted: raw?.apiKeyEncrypted ?? null,
  };
}

/** Pure domain merge — API key encryption is handled by the application layer. */
export function applyModelSettingsUpdate(
  current: ModelSettings,
  update: ModelSettingsUpdate,
  apiKeyEncrypted?: string | null,
): ModelSettings {
  const next: ModelSettings = { ...current };

  if (update.presetId !== undefined) next.presetId = update.presetId.trim();
  if (update.displayName !== undefined) {
    next.displayName = update.displayName.trim() || next.modelId;
  }
  if (update.baseURL !== undefined) {
    next.baseURL = update.baseURL.trim().replace(/\/$/, "");
  }
  if (update.modelId !== undefined) next.modelId = update.modelId.trim();
  if (update.contextWindowTokens !== undefined) {
    const n = Number(update.contextWindowTokens);
    if (!Number.isFinite(n) || n < 1024) {
      throw new Error("contextWindowTokens must be a number ≥ 1024");
    }
    next.contextWindowTokens = Math.floor(n);
  }
  if (update.reasoning !== undefined) next.reasoning = update.reasoning;

  if (apiKeyEncrypted !== undefined) {
    next.apiKeyEncrypted = apiKeyEncrypted;
  }

  if (!next.baseURL || !next.modelId) {
    throw new Error("baseURL and modelId are required");
  }

  return next;
}
