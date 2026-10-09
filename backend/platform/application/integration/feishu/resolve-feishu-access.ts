import { INTEGRATION_FEISHU } from "../../../domain/integration/integration-catalog.js";
import { feishuApiBase } from "../../../domain/integration/providers/feishu.js";
import { resolveAgentIdForEveSession } from "../../chat/chat-session.use-case.js";
import { getValidOAuthAccessToken } from "../integration-token.service.js";

export type FeishuAccess = {
  accessToken: string;
  apiBase: string;
};

export async function resolveFeishuAccessForSession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<FeishuAccess | null> {
  const agentId = await resolveAgentIdForEveSession({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  if (!agentId?.trim()) return null;
  const accessToken = await getValidOAuthAccessToken(
    input.userId,
    agentId.trim(),
    INTEGRATION_FEISHU,
  );
  if (!accessToken) return null;
  return { accessToken, apiBase: feishuApiBase() };
}

export const FEISHU_CONNECT_HINT =
  "Connect Feishu in Customize → Integrations for this agent before using Feishu tools.";
