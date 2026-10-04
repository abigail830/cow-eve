import {
  integrationCredentialScopeForId,
  type IntegrationCredentialScope,
} from "../../domain/integration/integration-scope.js";
import { drizzleAgentIntegrationRepository } from "../../infrastructure/persistence/integration/drizzle-agent-integration.repository.js";
import { drizzleUserIntegrationRepository } from "../../infrastructure/persistence/integration/drizzle-user-integration.repository.js";

export type IntegrationCredentialRow = {
  secretsEncrypted: Record<string, string>;
  config: Record<string, unknown>;
  updatedAt: Date;
  scope: IntegrationCredentialScope;
};

export async function getIntegrationCredentialRow(input: {
  userId: string;
  agentId: string;
  integrationId: string;
}): Promise<IntegrationCredentialRow | null> {
  const scope = integrationCredentialScopeForId(input.integrationId);
  if (scope === "agent") {
    const row = await drizzleAgentIntegrationRepository.getForUserAgent(
      input.userId,
      input.agentId,
      input.integrationId,
    );
    if (!row) return null;
    return {
      secretsEncrypted: row.secretsEncrypted,
      config: row.config,
      updatedAt: row.updatedAt,
      scope,
    };
  }
  const row = await drizzleUserIntegrationRepository.getForUser(
    input.userId,
    input.integrationId,
  );
  if (!row) return null;
  return {
    secretsEncrypted: row.secretsEncrypted,
    config: row.config,
    updatedAt: row.updatedAt,
    scope,
  };
}

export async function upsertIntegrationCredentialRow(input: {
  userId: string;
  agentId: string;
  integrationId: string;
  secretsEncrypted: Record<string, string>;
  config: Record<string, unknown>;
}): Promise<void> {
  const scope = integrationCredentialScopeForId(input.integrationId);
  if (scope === "agent") {
    await drizzleAgentIntegrationRepository.upsert({
      userId: input.userId,
      agentId: input.agentId,
      integrationId: input.integrationId,
      secretsEncrypted: input.secretsEncrypted,
      config: input.config,
    });
    return;
  }
  await drizzleUserIntegrationRepository.upsert({
    userId: input.userId,
    integrationId: input.integrationId,
    secretsEncrypted: input.secretsEncrypted,
    config: input.config,
  });
}
