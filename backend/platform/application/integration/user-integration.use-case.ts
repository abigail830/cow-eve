import {
  getIntegrationDefinition,
  INTEGRATION_CATALOG,
  INTEGRATION_HYBRID_SEARCH,
  INTEGRATION_ZHIPU_WEB_SEARCH,
  integrationsForAgent,
  type IntegrationDefinition,
  type IntegrationFieldDefinition,
} from "../../domain/integration/integration-catalog.js";
import {
  decryptSecret,
  encryptSecret,
} from "../../infrastructure/crypto/aes-secret-cipher.js";
import {
  getHybridSearchMcpUrl,
  getHybridSearchApiKey,
  getZhipuApiKey,
  normalizeHybridSearchApiKey,
  resolveFirstHttpUrl,
} from "../../infrastructure/config/mcp.config.js";
import { drizzleUserIntegrationRepository } from "../../infrastructure/persistence/integration/drizzle-user-integration.repository.js";

export type IntegrationFieldPublic = {
  key: string;
  kind: IntegrationFieldDefinition["kind"];
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  storeInConfig?: boolean;
};

export type IntegrationCatalogItemPublic = {
  id: string;
  name: string;
  description: string;
  docUrl: string;
  fields: IntegrationFieldPublic[];
  configured: boolean;
  config: Record<string, string>;
  secretHints: Record<string, string | null>;
  updatedAt: string | null;
};

function secretHint(encrypted: string | undefined): string | null {
  if (!encrypted) return null;
  try {
    const plain = decryptSecret(encrypted);
    if (plain.length <= 4) return "••••";
    return `••••${plain.slice(-4)}`;
  } catch {
    return "••••";
  }
}

function toFieldPublic(field: IntegrationFieldDefinition): IntegrationFieldPublic {
  return {
    key: field.key,
    kind: field.kind,
    label: field.label,
    description: field.description,
    placeholder: field.placeholder,
    required: field.required,
    storeInConfig: field.storeInConfig,
  };
}

function configStrings(
  raw: Record<string, unknown>,
  def: IntegrationDefinition,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of def.fields) {
    if (field.kind === "secret") continue;
    if (!field.storeInConfig) continue;
    const value = raw[field.key];
    if (typeof value === "string" && value.trim()) {
      out[field.key] = value.trim();
    }
  }
  return out;
}

export async function listIntegrationsForUser(input: {
  userId: string;
  agentId?: string;
}): Promise<IntegrationCatalogItemPublic[]> {
  const catalog = input.agentId
    ? integrationsForAgent(input.agentId)
    : [...INTEGRATION_CATALOG];
  const rows = await drizzleUserIntegrationRepository.listForUser(input.userId);
  const byId = new Map(rows.map((row) => [row.integrationId, row]));

  return catalog.map((def) => {
    const row = byId.get(def.id);
    const secretHints: Record<string, string | null> = {};
    for (const field of def.fields) {
      if (field.kind !== "secret") continue;
      secretHints[field.key] = secretHint(row?.secretsEncrypted[field.key]);
    }
    const hasSecrets = def.fields.some(
      (field) =>
        field.kind === "secret" &&
        Boolean(row?.secretsEncrypted[field.key]?.trim()),
    );
    const configFilled = def.fields.some(
      (field) =>
        field.storeInConfig &&
        typeof row?.config[field.key] === "string" &&
        String(row.config[field.key]).trim(),
    );
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      docUrl: def.docUrl,
      fields: def.fields.map(toFieldPublic),
      configured: hasSecrets || configFilled,
      config: row ? configStrings(row.config, def) : {},
      secretHints,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export type SaveUserIntegrationInput = {
  userId: string;
  integrationId: string;
  /** Secret field updates; omit or empty string keeps existing value */
  secrets?: Record<string, string | undefined>;
  config?: Record<string, string | undefined>;
};

export async function saveUserIntegration(
  input: SaveUserIntegrationInput,
): Promise<IntegrationCatalogItemPublic> {
  const def = getIntegrationDefinition(input.integrationId);
  if (!def) throw new Error("Unknown integration.");

  const existing = await drizzleUserIntegrationRepository.getForUser(
    input.userId,
    input.integrationId,
  );

  const secretsEncrypted: Record<string, string> = {
    ...(existing?.secretsEncrypted ?? {}),
  };

  for (const field of def.fields) {
    if (field.kind !== "secret") continue;
    const next = input.secrets?.[field.key];
    if (next === undefined) continue;
    const trimmed = next.trim();
    if (!trimmed) {
      if (field.required && !secretsEncrypted[field.key]) {
        throw new Error(`${field.label} is required.`);
      }
      delete secretsEncrypted[field.key];
      continue;
    }
    secretsEncrypted[field.key] = encryptSecret(trimmed);
  }

  for (const field of def.fields) {
    if (field.kind === "secret" && field.required && !secretsEncrypted[field.key]) {
      throw new Error(`${field.label} is required.`);
    }
  }

  const config: Record<string, unknown> = { ...(existing?.config ?? {}) };
  for (const field of def.fields) {
    if (!field.storeInConfig) continue;
    const next = input.config?.[field.key];
    if (next === undefined) continue;
    const trimmed = next.trim();
    if (!trimmed) {
      delete config[field.key];
    } else {
      config[field.key] = trimmed;
    }
  }

  await drizzleUserIntegrationRepository.upsert({
    userId: input.userId,
    integrationId: input.integrationId,
    secretsEncrypted,
    config,
  });

  const list = await listIntegrationsForUser({
    userId: input.userId,
  });
  const item = list.find((row) => row.id === input.integrationId);
  if (!item) throw new Error("Integration not found after save.");
  return item;
}

function readSecret(
  row: Awaited<ReturnType<typeof drizzleUserIntegrationRepository.getForUser>>,
  key: string,
): string | null {
  const enc = row?.secretsEncrypted[key];
  if (!enc) return null;
  try {
    return decryptSecret(enc).trim() || null;
  } catch {
    return null;
  }
}

export async function resolveZhipuWebSearchApiKey(
  userId: string | null,
): Promise<string | null> {
  if (userId) {
    const row = await drizzleUserIntegrationRepository.getForUser(
      userId,
      INTEGRATION_ZHIPU_WEB_SEARCH,
    );
    const fromUser = readSecret(row, "apiKey");
    if (fromUser) return fromUser;
  }
  return getZhipuApiKey();
}

export async function resolveHybridSearchCredentials(userId: string | null): Promise<{
  url: string | null;
  apiKey: string | null;
}> {
  if (userId) {
    const row = await drizzleUserIntegrationRepository.getForUser(
      userId,
      INTEGRATION_HYBRID_SEARCH,
    );
    const apiKey = normalizeHybridSearchApiKey(readSecret(row, "apiKey"));
    const configUrl =
      typeof row?.config?.mcpUrl === "string" ? row.config.mcpUrl : "";
    if (apiKey) {
      const url = resolveFirstHttpUrl(configUrl, getHybridSearchMcpUrl());
      return { url, apiKey };
    }
  }
  const url = getHybridSearchMcpUrl();
  const apiKey = getHybridSearchApiKey();
  return { url, apiKey };
}
