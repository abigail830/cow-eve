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
export {
  createUser,
  deleteUser,
  findUserByEmail,
  listUsers,
} from "../application/auth/user-admin.use-case";
export type {
  CreateUserInput,
  PlatformUserPublic,
} from "../application/auth/user-admin.use-case";
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
  defaultModelSettings,
  loadModelCatalog,
  loadModelSettings,
  saveModelCatalog,
  saveModelSettings,
  toPublicCatalog,
  toPublicSettings,
  getDecryptedApiKey,
} from "../application/settings/model-settings.use-case";
export type {
  ModelCatalog,
  ModelCatalogPublic,
  ModelCatalogUpdate,
  ModelEntry,
  ModelEntryPublic,
  ModelEntryUpdate,
  ModelPreset,
  ModelReasoning,
  ModelSettings,
  ModelSettingsPublic,
  ModelSettingsUpdate,
} from "../application/settings/model-settings.use-case";

// Chat persistence
export {
  deleteChatForUser,
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

// Artifacts
export {
  getArtifactDownloadForUser,
  getArtifactPreviewForUser,
  publishSandboxArtifact,
} from "../application/artifact/artifact.use-case";
export { contentDispositionAttachment } from "../infrastructure/artifact/local-artifact.store";

// Chat attachments
export {
  deleteChatAttachmentForUser,
  getChatAttachmentDownloadForUser,
  listChatAttachmentsForSession,
  listChatAttachmentsForUser,
  listChatAttachmentsForUserBySession,
  readChatAttachmentForSession,
  uploadChatAttachmentForUser,
} from "../application/attachment/chat-attachment.use-case";
export type { ReadChatAttachmentResult } from "../application/attachment/chat-attachment.use-case";
export {
  toPublicAttachment,
  type ChatAttachment,
  type ChatAttachmentPublic,
} from "../domain/attachment/chat-attachment.entity";

// Memory
export { getUserMemorySnapshot } from "../application/memory/memory.use-case";
export type {
  MemoryEntry,
  PreferenceEntry,
  UserMemorySnapshot,
} from "../application/memory/memory.use-case";

// Sandbox cleanup
export {
  killSandboxesForEveSession,
  sweepStaleSandboxes,
} from "../application/sandbox/sandbox-cleanup.use-case";
export type { SweepStaleSandboxesResult } from "../application/sandbox/sandbox-cleanup.use-case";

// Schedules
export {
  claimDueSchedules,
  completeSchedule,
  createScheduleForUser,
  deleteScheduleForUser,
  getScheduleForUser,
  listSchedulesForUser,
  linkScheduleRunChat,
  releaseSchedule,
  toPublicSchedule,
  updateScheduleForUser,
} from "../application/schedule/schedule.use-case";
export type { ScheduledTaskPublic } from "../application/schedule/schedule.use-case";
export type {
  ClaimedScheduleTask,
  CreateScheduleInput,
  ScheduledTask,
  UpdateScheduleInput,
} from "../domain/schedule/schedule.entity";
export { mintScheduledRunAuth } from "../application/auth/scheduled-token.use-case";

// Database (health checks / diagnostics)
export { getDatabaseUrl } from "../infrastructure/persistence/database";

// Eve adapters
export {
  platformCors,
  platformRouteAuth,
} from "../interfaces/eve/platform-auth.adapter";
export { platformDynamicModel } from "../interfaces/eve/platform-dynamic-model.adapter";
