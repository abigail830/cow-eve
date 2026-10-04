import { createHmac, randomBytes, createHash } from "node:crypto";

const STATE_VERSION = "v1";
const PENDING_TTL_SECONDS = 10 * 60;

export type OAuthPendingState = {
  userId: string;
  provider: string;
  codeVerifier: string;
  createdAt: number;
  agentId?: string;
};

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function signPayload(encodedPayload: string, signingKey: string): string {
  return createHmac("sha256", signingKey)
    .update(encodedPayload)
    .digest("base64url");
}

export function createOAuthState(input: {
  userId: string;
  provider: string;
  codeVerifier: string;
  signingKey: string;
  agentId?: string;
}): string {
  const payload: Record<string, string | number> = {
    user_id: input.userId.trim(),
    provider: input.provider.trim(),
    code_verifier: input.codeVerifier,
    created_at: Math.floor(Date.now() / 1000),
    nonce: randomBytes(16).toString("base64url"),
  };
  if (input.agentId?.trim()) {
    payload.agent_id = input.agentId.trim();
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded, input.signingKey);
  return `${STATE_VERSION}.${encoded}.${signature}`;
}

export function consumeOAuthState(
  state: string,
  signingKey: string,
): OAuthPendingState | null {
  const parts = state.trim().split(".");
  if (parts.length !== 3 || parts[0] !== STATE_VERSION) return null;

  const encoded = parts[1]!;
  const signature = parts[2]!;
  const expected = signPayload(encoded, signingKey);
  if (signature.length !== expected.length) return null;
  let match = 0;
  for (let i = 0; i < signature.length; i++) {
    match |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (match !== 0) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }

  const userId = parsed.user_id;
  const provider = parsed.provider;
  const codeVerifier = parsed.code_verifier;
  const createdAt = parsed.created_at;
  if (
    typeof userId !== "string" ||
    typeof provider !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof createdAt !== "number"
  ) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) - createdAt > PENDING_TTL_SECONDS) {
    return null;
  }

  const agentId = parsed.agent_id;
  return {
    userId,
    provider,
    codeVerifier,
    createdAt,
    agentId: typeof agentId === "string" ? agentId : undefined,
  };
}
