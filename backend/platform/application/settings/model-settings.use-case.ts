import {
  MODEL_PRESETS,
  applyModelSettingsUpdate,
  type ModelSettings,
  type ModelSettingsPublic,
  type ModelSettingsUpdate,
} from "../../domain/settings/model-settings.entity";
import {
  decryptSecret,
  encryptSecret,
} from "../../infrastructure/crypto/aes-secret-cipher";
import { drizzleModelSettingsRepository } from "../../infrastructure/persistence/settings/drizzle-model-settings.repository";

export { MODEL_PRESETS };
export type {
  ModelReasoning,
  ModelSettings,
  ModelSettingsPublic,
  ModelSettingsUpdate,
  ModelPreset,
} from "../../domain/settings/model-settings.entity";

export async function loadModelSettings(): Promise<ModelSettings> {
  return drizzleModelSettingsRepository.load();
}

export async function saveModelSettings(
  update: ModelSettingsUpdate,
): Promise<ModelSettings> {
  const current = await drizzleModelSettingsRepository.load();
  let encryptedKey: string | null | undefined;
  if (update.apiKey !== undefined && update.apiKey.trim() !== "") {
    encryptedKey = encryptSecret(update.apiKey.trim());
  } else if (update.apiKey !== undefined) {
    encryptedKey = current.apiKeyEncrypted;
  }

  const { apiKey: _ignored, ...fields } = update;
  const next = applyModelSettingsUpdate(current, fields, encryptedKey);
  return drizzleModelSettingsRepository.save(next);
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

/** @deprecated Prefer saveModelSettings(update) — kept for channel handlers that merge manually. */
export { applyModelSettingsUpdate } from "../../domain/settings/model-settings.entity";
