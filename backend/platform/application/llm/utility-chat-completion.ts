import { requireUtilityModelConfig } from "../../infrastructure/config/utility-model.config.js";

export type UtilityChatCompletionInput = {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
};

function chatCompletionsUrl(baseURL: string): string {
  const base = baseURL.replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

function isDashScopeBaseUrl(baseURL: string): boolean {
  return baseURL.toLowerCase().includes("dashscope");
}

/**
 * Direct OpenAI-compatible Chat Completions (no Eve agent). DashScope: enable_thinking=false.
 */
export async function completeUtilityChat(
  input: UtilityChatCompletionInput,
): Promise<string> {
  const { apiKey, baseURL, modelId } = requireUtilityModelConfig();
  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    max_tokens: input.maxTokens,
  };
  if (input.temperature !== undefined) {
    body.temperature = input.temperature;
  }
  if (isDashScopeBaseUrl(baseURL)) {
    body.enable_thinking = false;
  }

  const response = await fetch(chatCompletionsUrl(baseURL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Utility chat completion failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string;
      };
    }>;
  };
  const message = data.choices?.[0]?.message;
  const content = (message?.content ?? "").trim();
  if (content) return content;

  const reasoning = message?.reasoning_content?.trim();
  if (reasoning) {
    console.warn("[utility-llm] model returned reasoning only; content empty");
  }
  return "";
}
