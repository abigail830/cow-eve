import {
  MODEL_PRESETS,
  applyModelCatalogUpdate,
  applyModelSettingsUpdate,
  defaultModelSettings,
  modelEntryFromSettings,
  normalizeModelCatalog,
  type ModelCatalog,
  type ModelCatalogPublic,
  type ModelCatalogUpdate,
  type ModelSettings,
  type ModelSettingsPublic,
  type ModelSettingsUpdate,
} from "../../domain/settings/model-settings.entity";
import {
  decryptSecret,
  encryptSecret,
} from "../../infrastructure/crypto/aes-secret-cipher";
import { drizzleModelSettingsRepository } from "../../infrastructure/persistence/settings/drizzle-model-settings.repository";

export { MODEL_PRESETS, defaultModelSettings };
export type {
  ModelCatalog,
  ModelCatalogPublic,
  ModelCatalogUpdate,
  ModelEntry,
  ModelEntryPublic,
  ModelEntryUpdate,
  ModelPreset,
  ModelReasoning,
  ModelSettings,
  ModelSettingsPublic,
  ModelSettingsUpdate,
} from "../../domain/settings/model-settings.entity";

export async function loadModelCatalog(): Promise<ModelCatalog> {
  return normalizeModelCatalog(await drizzleModelSettingsRepository.load());
}

/** The model new chats actually call — the catalog default. */
export async function loadModelSettings(): Promise<ModelSettings> {
  return defaultModelSettings(await loadModelCatalog());
}

export async function saveModelCatalog(
  update: ModelCatalogUpdate,
): Promise<ModelCatalog> {
  const current = normalizeModelCatalog(
    await drizzleModelSettingsRepository.load(),
  );
  const encryptedKeys = new Map<string, string | null>();
  for (const item of update.models ?? []) {
    const id = item.id?.trim();
    if (!id || item.apiKey === undefined || item.apiKey.trim() === "") continue;
    encryptedKeys.set(id, encryptSecret(item.apiKey.trim()));
  }
  const next = applyModelCatalogUpdate(current, update, encryptedKeys);
  return drizzleModelSettingsRepository.save(next);
}

export async function saveModelSettings(
  update: ModelSettingsUpdate,
): Promise<ModelSettings> {
  const catalog = await loadModelCatalog();
  const current = defaultModelSettings(catalog);
  let encryptedKey: string | null | undefined;
  if (update.apiKey !== undefined && update.apiKey.trim() !== "") {
    encryptedKey = encryptSecret(update.apiKey.trim());
  } else if (update.apiKey !== undefined) {
    encryptedKey = current.apiKeyEncrypted;
  }

  const { apiKey: _ignored, ...fields } = update;
  const nextSettings = applyModelSettingsUpdate(current, fields, encryptedKey);
  const defaultId = catalog.models.some((model) => model.id === catalog.defaultId)
    ? catalog.defaultId
    : (catalog.models[0]?.id ?? "default");
  const entry = modelEntryFromSettings(nextSettings, defaultId);
  const models = catalog.models.some((model) => model.id === defaultId)
    ? catalog.models.map((model) => (model.id === defaultId ? entry : model))
    : [entry, ...catalog.models];
  const saved = await drizzleModelSettingsRepository.save({
    models,
    defaultId,
    updatedAt: catalog.updatedAt,
  });
  return defaultModelSettings(saved);
}

function apiKeyHint(apiKeyEncrypted: string | null): string | null {
  if (!apiKeyEncrypted) return null;
  try {
    const plain = decryptSecret(apiKeyEncrypted);
    return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
  } catch {
    return "••••";
  }
}

export function toPublicSettings(settings: ModelSettings): ModelSettingsPublic {
  const { apiKeyEncrypted, ...rest } = settings;
  return {
    ...rest,
    hasApiKey: Boolean(apiKeyEncrypted),
    apiKeyHint: apiKeyHint(apiKeyEncrypted),
  };
}

export function toPublicCatalog(catalog: ModelCatalog): ModelCatalogPublic {
  return {
    defaultId: catalog.defaultId,
    updatedAt: catalog.updatedAt,
    models: catalog.models.map((entry) => {
      const { apiKeyEncrypted, ...rest } = entry;
      return {
        ...rest,
        hasApiKey: Boolean(apiKeyEncrypted),
        apiKeyHint: apiKeyHint(apiKeyEncrypted),
      };
    }),
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

/** @deprecated Prefer saveModelSettings(update) — kept for channel handlers that merge manually. */
export { applyModelSettingsUpdate } from "../../domain/settings/model-settings.entity";
