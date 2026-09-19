import { drizzleChatRepository } from "../infrastructure/persistence/chat/drizzle-chat.repository";
import { drizzleUserRepository } from "../infrastructure/persistence/auth/drizzle-user.repository";
import { drizzleModelSettingsRepository } from "../infrastructure/persistence/settings/drizzle-model-settings.repository";

/** Composition root — default infrastructure singletons for tests to override. */
export const deps = {
  chatRepository: drizzleChatRepository,
  modelSettingsRepository: drizzleModelSettingsRepository,
  userRepository: drizzleUserRepository,
} as const;
