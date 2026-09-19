import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { decryptSecret, encryptSecret } from "./crypto";

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
  /** Display label shown in chat composer */
  displayName: string;
  /** OpenAI-compatible base URL, e.g. https://api.deepseek.com/v1 */
  baseURL: string;
  /** Provider model id, e.g. deepseek-chat / qwen-plus */
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

export const MODEL_PRESETS = [
  {
    id: "deepseek",
    label: "DeepSeek Chat",
    displayName: "DeepSeek Chat",
    baseURL: "https://api.deepseek.com/v1",
    modelId: "deepseek-chat",
    contextWindowTokens: 128_000,
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
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
] as const;

const DEFAULT_SETTINGS: ModelSettings = {
  presetId: "deepseek",
  displayName: "DeepSeek Chat",
  baseURL: "https://api.deepseek.com/v1",
  modelId: "deepseek-chat",
  contextWindowTokens: 128_000,
  reasoning: "provider-default",
  apiKeyEncrypted: null,
  updatedAt: null,
};

function findBackendRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8"),
      ) as { name?: string };
      if (pkg.name === "cow-eve-backend") return dir;
    } catch {
      // continue
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function settingsPath(): string {
  if (process.env.PLATFORM_DATA_DIR) {
    return join(process.env.PLATFORM_DATA_DIR, "model-settings.json");
  }
  return join(findBackendRoot(), "platform", "data", "model-settings.json");
}

export function loadModelSettings(): ModelSettings {
  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ModelSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      apiKeyEncrypted: raw.apiKeyEncrypted ?? null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveModelSettings(next: ModelSettings): ModelSettings {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  const toWrite: ModelSettings = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(toWrite, null, 2)}\n`, "utf8");
  return toWrite;
}

export function toPublicSettings(settings: ModelSettings): ModelSettingsPublic {
  const { apiKeyEncrypted, ...rest } = settings;
  let apiKeyHint: string | null = null;
  if (apiKeyEncrypted) {
    try {
      const plain = decryptSecret(apiKeyEncrypted);
      apiKeyHint = plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
    } catch {
      apiKeyHint = "••••";
    }
  }
  return {
    ...rest,
    hasApiKey: Boolean(apiKeyEncrypted),
    apiKeyHint,
  };
}

export function getDecryptedApiKey(settings: ModelSettings): string | null {
  if (!settings.apiKeyEncrypted) return null;
  try {
    return decryptSecret(settings.apiKeyEncrypted);
  } catch {
    return null;
  }
}

export function applyModelSettingsUpdate(
  current: ModelSettings,
  update: ModelSettingsUpdate,
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

  if (update.apiKey !== undefined && update.apiKey.trim() !== "") {
    next.apiKeyEncrypted = encryptSecret(update.apiKey.trim());
  }

  if (!next.baseURL || !next.modelId) {
    throw new Error("baseURL and modelId are required");
  }

  return next;
}
