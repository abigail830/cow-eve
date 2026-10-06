import {
  getIntegrationDefinition,
  INTEGRATION_CATALOG,
  INTEGRATION_HYBRID_SEARCH,
  INTEGRATION_PROPOSAL_KNOWLEDGE,
  INTEGRATION_ZHIPU_WEB_SEARCH,
  type IntegrationDefinition,
  type IntegrationFieldDefinition,
} from "../../domain/integration/integration-catalog.js";
import { integrationCredentialScope } from "../../domain/integration/integration-scope.js";
import {
  getIntegrationCredentialRow,
  upsertIntegrationCredentialRow,
} from "./integration-credential.store.js";
import {
  decryptSecret,
  encryptSecret,
} from "../../infrastructure/crypto/aes-secret-cipher.js";
import {
  getHybridSearchMcpUrl,
  getHybridSearchApiKey,
  getProposalCatalogMcpUrl,
  getProposalCvMcpUrl,
  getProposalKnowledgeApiKey,
  getZhipuApiKey,
  normalizeHybridSearchApiKey,
  normalizeProposalKnowledgeApiKey,
  normalizeHttpUrl,
  resolveFirstHttpUrl,
} from "../../infrastructure/config/mcp.config.js";
import { drizzleUserIntegrationRepository } from "../../infrastructure/persistence/integration/drizzle-user-integration.repository.js";
import { getOAuthIntegrationHandler } from "../../domain/integration/integration-oauth-registry.js";
import {
  getValidOAuthAccessToken,
  loadOAuthTokens,
  readAccountLabelFromConfig,
} from "./integration-token.service.js";
import { OAUTH_SECRET_FIELD } from "../../domain/integration/oauth/types.js";
import { integrationsForAgent } from "./integrations-for-agent.js";

export type IntegrationFieldPublic = {
  key: string;
  kind: IntegrationFieldDefinition["kind"];
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required: boolean;
  storeInConfig?: boolean;
};

export type IntegrationCatalogItemPublic = {
  id: string;
  name: string;
  description: string;
  docUrl: string;
  authKind: IntegrationDefinition["authKind"];
  scope: "user" | "agent";
  /** Deployment has OAuth client env (oauth) or always true for api_key. */
  platformConfigured: boolean;
  fields: IntegrationFieldPublic[];
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
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
    defaultValue: field.defaultValue,
    required: field.required,
    storeInConfig: field.storeInConfig,
  };
}

/** Env-backed placeholders for Integrations UI only (not persisted until Save). */
function fieldsPublicForDefinition(
  def: IntegrationDefinition,
): IntegrationFieldPublic[] {
  return def.fields.map((field) => {
    const pub = toFieldPublic(field);
    if (def.id !== INTEGRATION_PROPOSAL_KNOWLEDGE) return pub;
    if (field.key === "catalogMcpUrl" && !pub.defaultValue?.trim()) {
      const fromEnv = getProposalCatalogMcpUrl();
      if (fromEnv) return { ...pub, defaultValue: fromEnv };
    }
    if (field.key === "cvMcpUrl" && !pub.defaultValue?.trim()) {
      const fromEnv = getProposalCvMcpUrl();
      if (fromEnv) return { ...pub, defaultValue: fromEnv };
    }
    return pub;
  });
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
  if (!input.agentId?.trim()) {
    throw new Error("agentId is required.");
  }
  const agentId = input.agentId.trim();
  const catalog = integrationsForAgent(agentId);
  const userRows = await drizzleUserIntegrationRepository.listForUser(
    input.userId,
  );
  const userById = new Map(userRows.map((row) => [row.integrationId, row]));

  const items: IntegrationCatalogItemPublic[] = [];
  for (const def of catalog) {
    const scope = integrationCredentialScope(def);
    const cred =
      scope === "agent"
        ? await getIntegrationCredentialRow({
            userId: input.userId,
            agentId,
            integrationId: def.id,
          })
        : null;
    const row =
      scope === "user" ? userById.get(def.id) : cred;
    const secretsEncrypted =
      scope === "user"
        ? row && "secretsEncrypted" in row
          ? row.secretsEncrypted
          : {}
        : cred?.secretsEncrypted ?? {};
    const configRaw =
      scope === "user"
        ? row && "config" in row
          ? row.config
          : {}
        : cred?.config ?? {};
    const updatedAt =
      scope === "user" && row && "updatedAt" in row
        ? row.updatedAt
        : cred?.updatedAt;

    const oauthHandler = getOAuthIntegrationHandler(def.id);
    const platformConfigured =
      def.authKind === "oauth"
        ? Boolean(oauthHandler?.isPlatformConfigured())
        : true;

    if (def.authKind === "oauth") {
      const hasOAuth = Boolean(secretsEncrypted[OAUTH_SECRET_FIELD]?.trim());
      items.push({
        id: def.id,
        name: def.name,
        description: def.description,
        docUrl: def.docUrl,
        authKind: def.authKind,
        scope,
        platformConfigured,
        fields: [],
        configured: hasOAuth,
        connected: hasOAuth,
        accountLabel: readAccountLabelFromConfig(configRaw),
        config: {},
        secretHints: {},
        updatedAt: updatedAt?.toISOString() ?? null,
      });
      continue;
    }

    const secretHints: Record<string, string | null> = {};
    for (const field of def.fields) {
      if (field.kind !== "secret") continue;
      secretHints[field.key] = secretHint(secretsEncrypted[field.key]);
    }
    const hasSecrets = def.fields.some(
      (field) =>
        field.kind === "secret" &&
        Boolean(secretsEncrypted[field.key]?.trim()),
    );
    const configFilled = def.fields.some(
      (field) =>
        field.storeInConfig &&
        typeof configRaw[field.key] === "string" &&
        String(configRaw[field.key]).trim(),
    );
    items.push({
      id: def.id,
      name: def.name,
      description: def.description,
      docUrl: def.docUrl,
      authKind: def.authKind,
      scope,
      platformConfigured,
      fields: fieldsPublicForDefinition(def),
      configured: hasSecrets || configFilled,
      connected: hasSecrets || configFilled,
      accountLabel: null,
      config: configStrings(configRaw, def),
      secretHints,
      updatedAt: updatedAt?.toISOString() ?? null,
    });
  }
  return items;
}

export type SaveUserIntegrationInput = {
  userId: string;
  agentId: string;
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
  if (def.authKind === "oauth") {
    throw new Error("Use Connect in Integrations to authorize this service.");
  }
  if (!input.agentId?.trim()) {
    throw new Error("agentId is required.");
  }

  const existing = await getIntegrationCredentialRow({
    userId: input.userId,
    agentId: input.agentId.trim(),
    integrationId: input.integrationId,
  });

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
    } else if (field.kind === "url") {
      const normalized = normalizeHttpUrl(trimmed);
      if (!normalized) {
        throw new Error(`${field.label} must be a valid http(s) URL.`);
      }
      config[field.key] = normalized;
    } else {
      config[field.key] = trimmed;
    }
  }

  await upsertIntegrationCredentialRow({
    userId: input.userId,
    agentId: input.agentId.trim(),
    integrationId: input.integrationId,
    secretsEncrypted,
    config,
  });

  const list = await listIntegrationsForUser({
    userId: input.userId,
    agentId: input.agentId,
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

export async function resolveProposalKnowledgeCredentials(
  userId: string | null,
): Promise<{
  catalogUrl: string | null;
  cvUrl: string | null;
  apiKey: string | null;
}> {
  if (userId) {
    const row = await drizzleUserIntegrationRepository.getForUser(
      userId,
      INTEGRATION_PROPOSAL_KNOWLEDGE,
    );
    const apiKey = normalizeProposalKnowledgeApiKey(readSecret(row, "apiKey"));
    const config = row?.config ?? {};
    const catalogFromConfig =
      typeof config.catalogMcpUrl === "string" ? config.catalogMcpUrl : "";
    const cvFromConfig =
      typeof config.cvMcpUrl === "string" ? config.cvMcpUrl : "";
    if (apiKey) {
      const catalogUrl = resolveFirstHttpUrl(
        catalogFromConfig,
        getProposalCatalogMcpUrl(),
      );
      const cvUrl = resolveFirstHttpUrl(cvFromConfig, getProposalCvMcpUrl());
      return { catalogUrl, cvUrl, apiKey };
    }
  }
  return {
    catalogUrl: getProposalCatalogMcpUrl(),
    cvUrl: getProposalCvMcpUrl(),
    apiKey: getProposalKnowledgeApiKey(),
  };
}

export async function resolveIntegrationMcpAccessToken(
  userId: string | null,
  agentId: string | null,
  integrationId: string,
): Promise<{ token: string; expiresAtMs: number } | null> {
  if (!userId || !agentId?.trim()) return null;
  const def = getIntegrationDefinition(integrationId);
  if (!def || def.authKind !== "oauth") return null;
  const stored = await loadOAuthTokens(userId, agentId.trim(), integrationId);
  const token = await getValidOAuthAccessToken(
    userId,
    agentId.trim(),
    integrationId,
  );
  if (!token) return null;
  const expiresAtMs = stored?.expiresAtMs ?? Date.now() + 3600_000;
  return { token, expiresAtMs };
}
