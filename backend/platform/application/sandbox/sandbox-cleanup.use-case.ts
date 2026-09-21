import { killSandboxesForEveSession } from "../../infrastructure/sandbox/e2b-sandbox-kill";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository";
import { getDatabaseUrl } from "../../infrastructure/persistence/database";

const DEFAULT_IDLE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AGENT_IDS = ["omni"];

function parseIdleMs(): number {
  const raw = process.env.SANDBOX_CLEANUP_IDLE_MS?.trim();
  if (!raw) return DEFAULT_IDLE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_MS;
}

function parseAgentIds(): string[] {
  const raw = process.env.SANDBOX_CLEANUP_AGENT_IDS?.trim();
  if (!raw) return DEFAULT_AGENT_IDS;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : DEFAULT_AGENT_IDS;
}

export type SweepStaleSandboxesResult = {
  scanned: number;
  killed: number;
  errors: string[];
};

/** Kill E2B sandboxes for chats that have been idle longer than SANDBOX_CLEANUP_IDLE_MS. */
export async function sweepStaleSandboxes(): Promise<SweepStaleSandboxesResult> {
  if (!getDatabaseUrl()) {
    return { scanned: 0, killed: 0, errors: [] };
  }

  const cutoff = new Date(Date.now() - parseIdleMs());
  const chats = await drizzleChatRepository.listChatsInactiveSince({
    cutoff,
    agentIds: parseAgentIds(),
  });

  let killed = 0;
  const errors: string[] = [];

  for (const chat of chats) {
    const result = await killSandboxesForEveSession(chat.eveSessionId);
    killed += result.killed;
    errors.push(...result.errors);
  }

  if (killed > 0 || errors.length > 0) {
    console.info("[sandbox-cleanup] sweep complete", {
      scanned: chats.length,
      killed,
      errorCount: errors.length,
    });
  }

  return { scanned: chats.length, killed, errors };
}

export { killSandboxesForEveSession };
