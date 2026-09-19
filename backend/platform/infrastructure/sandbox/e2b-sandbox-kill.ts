import { Sandbox, SandboxNotFoundError } from "e2b";

const BACKEND_NAME = "e2b";
const METADATA_BACKEND_KEY = "eveBackend";
const METADATA_SESSION_KEY = "eveSessionKey";

function e2bConnection() {
  const apiKey = process.env.E2B_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey };
}

/** Match eve session id embedded in eveSessionKey (`...-{sessionId}-{nodeId}`). */
function sessionKeyMatchesEveSessionId(
  sessionKey: unknown,
  eveSessionId: string,
): boolean {
  if (typeof sessionKey !== "string" || !eveSessionId.trim()) return false;
  return sessionKey.includes(`-${eveSessionId}-`);
}

export type KillSandboxesResult = {
  killed: number;
  errors: string[];
};

/**
 * Best-effort kill of E2B sandboxes tied to an Eve durable session id.
 * Missing API key, not-found, and partial kills are non-fatal.
 */
export async function killSandboxesForEveSession(
  eveSessionId: string,
): Promise<KillSandboxesResult> {
  const connection = e2bConnection();
  if (!connection) return { killed: 0, errors: [] };

  const trimmed = eveSessionId.trim();
  if (!trimmed) return { killed: 0, errors: [] };

  let killed = 0;
  const errors: string[] = [];

  const paginator = Sandbox.list({
    ...connection,
    query: {
      metadata: { [METADATA_BACKEND_KEY]: BACKEND_NAME },
      state: ["running", "paused"],
    },
  });

  while (paginator.hasNext) {
    const items = await paginator.nextItems(connection);
    for (const info of items) {
      const sessionKey = info.metadata?.[METADATA_SESSION_KEY];
      if (!sessionKeyMatchesEveSessionId(sessionKey, trimmed)) continue;

      try {
        await Sandbox.kill(info.sandboxId, connection);
        killed += 1;
      } catch (error) {
        if (error instanceof SandboxNotFoundError) continue;
        const message =
          error instanceof Error ? error.message : String(error);
        errors.push(
          `failed to kill sandbox ${info.sandboxId} for session ${trimmed}: ${message}`,
        );
      }
    }
  }

  return { killed, errors };
}
