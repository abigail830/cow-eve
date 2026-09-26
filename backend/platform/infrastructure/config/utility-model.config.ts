function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export type UtilityModelConfig = {
  apiKey: string;
  baseURL: string;
  modelId: string;
};

export function getUtilityModelConfig(): UtilityModelConfig | null {
  const apiKey = trimEnv("UTILITY_MODEL_API_KEY");
  const baseURL = trimEnv("UTILITY_MODEL_BASE_URL");
  const modelId =
    trimEnv("UTILITY_MODEL_DEPLOYMENT") || trimEnv("UTILITY_MODEL_ID");
  if (!apiKey || !baseURL || !modelId) return null;
  return { apiKey, baseURL, modelId };
}

export function requireUtilityModelConfig(): UtilityModelConfig {
  const config = getUtilityModelConfig();
  if (!config) {
    throw new Error(
      "UTILITY_MODEL_API_KEY, UTILITY_MODEL_BASE_URL, and UTILITY_MODEL_DEPLOYMENT are required for utility LLM (e.g. attachment gist)",
    );
  }
  return config;
}
