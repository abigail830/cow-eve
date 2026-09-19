/**
 * Stable platform surface for Eve agents and hooks.
 * Import from here instead of deep layer paths.
 */

// Auth
export { loginWithPassword } from "../application/auth/login.use-case";
export type {
  LoginFailure,
  LoginSuccess,
} from "../application/auth/login.use-case";
export {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "../domain/auth/auth.constants";
export { findUserByEmail } from "../domain/auth/user.entity";
export type { PlatformUser } from "../domain/auth/user.entity";
export {
  getFrontendOrigins,
  getJwtSecret,
  resolveCorsOrigin,
} from "../infrastructure/config/env.config";

// Registry
export {
  getAgent,
  listAgents,
  AGENT_REGISTRY,
} from "../domain/registry/agent.entity";
export type { AgentRegistryEntry } from "../domain/registry/agent.entity";

// Model settings
export {
  MODEL_PRESETS,
  applyModelSettingsUpdate,
  loadModelSettings,
  saveModelSettings,
  toPublicSettings,
  getDecryptedApiKey,
} from "../application/settings/model-settings.use-case";
export type {
  ModelPreset,
  ModelReasoning,
  ModelSettings,
  ModelSettingsPublic,
  ModelSettingsUpdate,
} from "../application/settings/model-settings.use-case";

// Chat persistence
export {
  getChatForUser,
  listChats,
  persistStreamEvent,
  softDeleteChat,
} from "../application/chat/chat.use-case";
export type {
  Chat,
  ChatEvent,
  ChatWithEvents,
  PersistableEvent,
} from "../application/chat/chat.use-case";

// Memory
export { getUserMemorySnapshot } from "../application/memory/memory.use-case";
export type {
  MemoryEntry,
  PreferenceEntry,
  UserMemorySnapshot,
} from "../application/memory/memory.use-case";

// Database (health checks / diagnostics)
export { getDatabaseUrl } from "../infrastructure/persistence/database";

// Eve adapters
export {
  platformCors,
  platformRouteAuth,
} from "../interfaces/eve/platform-auth.adapter";
export { platformDynamicModel } from "../interfaces/eve/platform-dynamic-model.adapter";
