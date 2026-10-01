import { loadLocalBackendEnvOnce } from "./load-local-env.js";
import { getUtilityModelConfig } from "./utility-model.config.js";

loadLocalBackendEnvOnce();

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 10);
}

/** User message count after which we run the one-shot LLM title (default 2). */
export function getTitleLlmAfterUserTurn(): number {
  return parsePositiveInt(trimEnv("TITLE_LLM_AFTER_USER_TURN"), 2);
}

export function isChatTitleLlmEnabled(): boolean {
  return getUtilityModelConfig() !== null;
}

export const CHAT_TITLE_SNIPPET_MAX_CHARS = 500;
export const CHAT_TITLE_PROMPT_MAX_CHARS = 2000;
export const CHAT_TITLE_LLM_MAX_TOKENS = 32;
