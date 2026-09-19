import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineDynamic } from "eve";
import {
  getDecryptedApiKey,
  loadModelSettings,
} from "../../application/settings/model-settings.use-case";

/**
 * Resolve the platform OpenAI-compatible model at each model step.
 * Live LanguageModel instances are only allowed from `step.started`.
 */
export function platformDynamicModel() {
  return defineDynamic({
    events: {
      "step.started": async () => {
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

        return {
          model: provider.chatModel(settings.modelId),
          modelContextWindowTokens: settings.contextWindowTokens,
          reasoning: settings.reasoning,
        };
      },
    },
  });
}
