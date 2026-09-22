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
  /** Provider model id, e.g. deepseek-flash / qwen3.7-plus */
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

/** One saved OpenAI-compatible endpoint. Chat uses the catalog default. */
export type ModelEntry = {
  id: string;
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  apiKeyEncrypted: string | null;
};

export type ModelCatalog = {
  models: ModelEntry[];
  defaultId: string;
  updatedAt: string | null;
};

export type ModelEntryPublic = Omit<ModelEntry, "apiKeyEncrypted"> & {
  hasApiKey: boolean;
  apiKeyHint: string | null;
};

export type ModelCatalogPublic = {
  models: ModelEntryPublic[];
  defaultId: string;
  updatedAt: string | null;
};

export type ModelEntryUpdate = {
  id: string;
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  /** Omit or leave blank to keep the key already stored for this id. */
  apiKey?: string;
};

export type ModelCatalogUpdate = {
  defaultId: string;
  models: ModelEntryUpdate[];
};

/** Common context sizes for Settings UI and preset defaults. */
export const CONTEXT_WINDOW_OPTIONS = [
  { label: "128K", value: 131_072 },
  { label: "256K", value: 262_144 },
  { label: "512K", value: 524_288 },
  { label: "1M", value: 1_000_000 },
] as const;

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 1_000_000;

export const MODEL_PRESETS: readonly ModelPreset[] = [
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

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  presetId: "deepseek",
  displayName: "DeepSeek Flash",
  baseURL: "https://api.deepseek.com/v1",
  modelId: "deepseek-flash",
  contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
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

const REASONING_VALUES = new Set<ModelReasoning>([
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

function isReasoning(value: unknown): value is ModelReasoning {
  return typeof value === "string" && REASONING_VALUES.has(value as ModelReasoning);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function modelEntryFromSettings(
  settings: ModelSettings,
  id: string,
): ModelEntry {
  return {
    id,
    presetId: settings.presetId,
    displayName: settings.displayName,
    baseURL: settings.baseURL,
    modelId: settings.modelId,
    contextWindowTokens: settings.contextWindowTokens,
    reasoning: settings.reasoning,
    apiKeyEncrypted: settings.apiKeyEncrypted,
  };
}

export function defaultModelSettings(catalog: ModelCatalog): ModelSettings {
  const entry =
    catalog.models.find((model) => model.id === catalog.defaultId) ??
    catalog.models[0];
  if (!entry) return { ...DEFAULT_MODEL_SETTINGS };
  return {
    presetId: entry.presetId,
    displayName: entry.displayName,
    baseURL: entry.baseURL,
    modelId: entry.modelId,
    contextWindowTokens: entry.contextWindowTokens,
    reasoning: entry.reasoning,
    apiKeyEncrypted: entry.apiKeyEncrypted,
    updatedAt: catalog.updatedAt,
  };
}

function normalizeModelEntry(raw: unknown, index: number): ModelEntry | null {
  if (!isRecord(raw)) return null;
  const modelId = typeof raw.modelId === "string" ? raw.modelId.trim() : "";
  const baseURL =
    typeof raw.baseURL === "string" ? raw.baseURL.trim().replace(/\/$/, "") : "";
  if (!modelId || !baseURL) return null;
  const context = Number(raw.contextWindowTokens);
  const id =
    typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `model-${index + 1}`;
  const presetId =
    typeof raw.presetId === "string" && raw.presetId.trim()
      ? raw.presetId.trim()
      : "custom";
  const displayName =
    typeof raw.displayName === "string" && raw.displayName.trim()
      ? raw.displayName.trim()
      : modelId;
  return {
    id,
    presetId,
    displayName,
    baseURL,
    modelId,
    contextWindowTokens:
      Number.isFinite(context) && context >= 1024
        ? Math.floor(context)
        : DEFAULT_CONTEXT_WINDOW_TOKENS,
    reasoning: isReasoning(raw.reasoning) ? raw.reasoning : "provider-default",
    apiKeyEncrypted:
      typeof raw.apiKeyEncrypted === "string" ? raw.apiKeyEncrypted : null,
  };
}

const LEGACY_PRESET_CONTEXT = 128_000;

function upgradeLegacyModelEntry(entry: ModelEntry): ModelEntry {
  if (entry.presetId === "qwen-plus" && entry.contextWindowTokens === LEGACY_PRESET_CONTEXT) {
    return {
      ...entry,
      presetId: "qwen3.7-plus",
      modelId: "qwen3.7-plus",
      contextWindowTokens: 1_000_000,
    };
  }

  const preset = MODEL_PRESETS.find((item) => item.id === entry.presetId);
  if (
    preset &&
    preset.id !== "custom" &&
    entry.contextWindowTokens === LEGACY_PRESET_CONTEXT &&
    preset.contextWindowTokens !== LEGACY_PRESET_CONTEXT
  ) {
    return { ...entry, contextWindowTokens: preset.contextWindowTokens };
  }

  return entry;
}

function dedupeIds(models: ModelEntry[]): ModelEntry[] {
  const seen = new Set<string>();
  return models.map((model) => {
    let id = model.id;
    let n = 2;
    while (seen.has(id)) {
      id = `${model.id}-${n}`;
      n += 1;
    }
    seen.add(id);
    return id === model.id ? model : { ...model, id };
  });
}

/** Accepts the current catalog or the legacy single-model payload. */
export function normalizeModelCatalog(raw: unknown): ModelCatalog {
  if (isRecord(raw) && Array.isArray(raw.models)) {
    const models = dedupeIds(
      raw.models
        .map((item, index) => normalizeModelEntry(item, index))
        .filter((item): item is ModelEntry => item !== null)
        .map(upgradeLegacyModelEntry),
    );
    const list =
      models.length > 0
        ? models
        : [modelEntryFromSettings({ ...DEFAULT_MODEL_SETTINGS }, "default")];
    const requested =
      typeof raw.defaultId === "string" ? raw.defaultId.trim() : "";
    const defaultId = list.some((model) => model.id === requested)
      ? requested
      : list[0].id;
    return {
      models: list,
      defaultId,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    };
  }

  const settings = normalizeModelSettings(
    isRecord(raw) ? (raw as Partial<ModelSettings>) : undefined,
  );
  const entry = modelEntryFromSettings(settings, "default");
  return {
    models: [entry],
    defaultId: entry.id,
    updatedAt: settings.updatedAt,
  };
}

/** Pure domain merge — API key encryption is handled by the application layer. */
export function applyModelCatalogUpdate(
  current: ModelCatalog,
  update: ModelCatalogUpdate,
  encryptedKeys?: ReadonlyMap<string, string | null>,
): ModelCatalog {
  if (!update.models?.length) {
    throw new Error("Add at least one model");
  }

  const seen = new Set<string>();
  const models: ModelEntry[] = update.models.map((item) => {
    const id = item.id?.trim();
    if (!id) throw new Error("Each model needs an id");
    if (seen.has(id)) throw new Error("Duplicate model id");
    seen.add(id);

    const modelId = item.modelId?.trim() ?? "";
    const baseURL = item.baseURL?.trim().replace(/\/$/, "") ?? "";
    if (!baseURL || !modelId) {
      throw new Error("baseURL and modelId are required");
    }

    const context = Number(item.contextWindowTokens);
    if (!Number.isFinite(context) || context < 1024) {
      throw new Error("contextWindowTokens must be a number ≥ 1024");
    }
    if (!isReasoning(item.reasoning)) {
      throw new Error("Invalid reasoning value");
    }

    const existing = current.models.find((model) => model.id === id);
    let apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
    if (encryptedKeys?.has(id)) {
      apiKeyEncrypted = encryptedKeys.get(id) ?? null;
    }

    return {
      id,
      presetId: item.presetId?.trim() || "custom",
      displayName: item.displayName?.trim() || modelId,
      baseURL,
      modelId,
      contextWindowTokens: Math.floor(context),
      reasoning: item.reasoning,
      apiKeyEncrypted,
    };
  });

  const defaultId = update.defaultId?.trim() ?? "";
  if (!models.some((model) => model.id === defaultId)) {
    throw new Error("Choose one saved model as the default");
  }

  return {
    models,
    defaultId,
    updatedAt: current.updatedAt,
  };
}
