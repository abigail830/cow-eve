import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  getDecryptedApiKey,
  loadModelSettings,
} from "#platform/composition/public-api.js";

export async function loadPlatformChatModel(): Promise<LanguageModel> {
  const settings = await loadModelSettings();
  if (!settings.baseURL || !settings.modelId) {
    throw new Error(
      "Model API is not configured. Open Settings → Model and set Base URL + Model ID.",
    );
  }
  const apiKey = getDecryptedApiKey(settings);
  if (!apiKey) {
    throw new Error(
      "Model API key is missing. Open Settings → Model and save your API key.",
    );
  }

  const provider = createOpenAICompatible({
    name: settings.presetId || "openai-compatible",
    baseURL: settings.baseURL,
    apiKey,
  });

  return provider.chatModel(settings.modelId);
}
