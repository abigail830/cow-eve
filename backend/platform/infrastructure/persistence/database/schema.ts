import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    eveSessionId: text("eve_session_id").notNull().unique(),
    /** Eve session stream cursor — equals persisted event count when storage is complete. */
    eveStreamIndex: integer("eve_stream_index").notNull().default(0),
    title: text("title"),
    /** null = interim (e.g. titleFromMessage); llm | user */
    titleSource: text("title_source"),
    titleGeneratedAt: timestamp("title_generated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    projectId: uuid("project_id"),
    scheduledTaskId: uuid("scheduled_task_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chats_user_agent_updated_idx")
      .on(table.userId, table.agentId, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("chats_user_agent_project_idx")
      .on(table.userId, table.agentId, table.projectId)
      .where(sql`${table.deletedAt} is null`),
    index("chats_scheduled_task_idx")
      .on(table.scheduledTaskId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const chatEvents = pgTable(
  "chat_events",
  {
    id: text("id").primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    emittedAt: timestamp("emitted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("chat_events_chat_emitted_idx").on(table.chatId, table.emittedAt),
  ],
);

export const platformUsers = pgTable("platform_users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Singleton (and future) platform config rows — e.g. id = "model". */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash"),
    parseStatus: text("parse_status").notNull().default("ready"),
    parsePipelineId: text("parse_pipeline_id"),
    parseJobId: text("parse_job_id"),
    parseErrorCode: text("parse_error_code"),
    parseErrorMessage: text("parse_error_message"),
    parseStageSnapshot: jsonb("parse_stage_snapshot"),
    parsedArtifactManifest: jsonb("parsed_artifact_manifest"),
    gist: text("gist"),
    gistContentSha256: text("gist_content_sha256"),
    gistGeneratedAt: timestamp("gist_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_attachments_chat_created_idx").on(
      table.chatId,
      table.createdAt,
    ),
    uniqueIndex("chat_attachments_chat_filename_idx").on(
      table.chatId,
      table.filename,
    ),
  ],
);

/** Published deliverables index (blob holds bytes; list API reads this table only). */
export const chatArtifacts = pgTable(
  "chat_artifacts",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    artifactId: text("artifact_id").notNull(),
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    filename: text("filename").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    format: text("format").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.artifactId] }),
    index("chat_artifacts_user_agent_created_idx").on(
      table.userId,
      table.agentId,
      table.createdAt,
    ),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    name: text("name").notNull(),
    instructions: text("instructions").default("").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("projects_user_agent_updated_idx")
      .on(table.userId, table.agentId, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const userAgentKbPreferences = pgTable(
  "user_agent_kb_preferences",
  {
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    disabledKbIds: jsonb("disabled_kb_ids").notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.agentId] })],
);

export const projectKbPreferences = pgTable("project_kb_preferences", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  disabledKbIds: jsonb("disabled_kb_ids").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projectWorkspaceFileRefs = pgTable(
  "project_workspace_file_refs",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceFileId: uuid("workspace_file_id")
      .notNull()
      .references(() => workspaceFiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.workspaceFileId] }),
    index("project_workspace_file_refs_file_idx").on(table.workspaceFileId),
  ],
);

export const chatSessionBindings = pgTable("chat_session_bindings", {
  eveSessionId: text("eve_session_id").primaryKey(),
  userId: text("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workspaceFolders = pgTable(
  "workspace_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_folders_user_name_idx").on(table.userId, table.name),
  ],
);

export const workspaceFiles = pgTable(
  "workspace_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => workspaceFolders.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash"),
    parseStatus: text("parse_status").notNull().default("ready"),
    parsePipelineId: text("parse_pipeline_id"),
    parseJobId: text("parse_job_id"),
    parseErrorCode: text("parse_error_code"),
    parseErrorMessage: text("parse_error_message"),
    parseStageSnapshot: jsonb("parse_stage_snapshot"),
    parsedArtifactManifest: jsonb("parsed_artifact_manifest"),
    gist: text("gist"),
    gistContentSha256: text("gist_content_sha256"),
    gistGeneratedAt: timestamp("gist_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_files_folder_filename_idx").on(
      table.folderId,
      table.filename,
    ),
    index("workspace_files_user_idx").on(table.userId),
  ],
);

export const parseJobRuns = pgTable(
  "parse_job_runs",
  {
    jobId: text("job_id").primaryKey(),
    attachmentId: uuid("attachment_id").notNull(),
    sourceKind: text("source_kind").notNull().default("chat_attachment"),
    scopeId: text("scope_id").notNull(),
    chatId: uuid("chat_id").references(() => chats.id, { onDelete: "cascade" }),
    runTokenHash: text("run_token_hash").notNull(),
    webhookSecret: text("webhook_secret").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    jobPayloadJson: jsonb("job_payload_json").notNull(),
    status: text("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("parse_job_runs_attachment_idx").on(table.attachmentId)],
);

export const audioCaptures = pgTable(
  "audio_captures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    outputAttachmentId: uuid("output_attachment_id").references(
      () => chatAttachments.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audio_captures_chat_created_idx").on(
      table.chatId,
      table.createdAt,
    ),
  ],
);

export const audioCaptureParts = pgTable(
  "audio_capture_parts",
  {
    captureId: uuid("capture_id")
      .notNull()
      .references(() => audioCaptures.id, { onDelete: "cascade" }),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => chatAttachments.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.captureId, table.attachmentId] }),
    index("audio_capture_parts_attachment_idx").on(table.attachmentId),
  ],
);

export const userIntegrations = pgTable(
  "user_integrations",
  {
    userId: text("user_id").notNull(),
    integrationId: text("integration_id").notNull(),
    secretsEncrypted: jsonb("secrets_encrypted").notNull().default({}),
    config: jsonb("config").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.integrationId] }),
    index("user_integrations_user_idx").on(table.userId),
  ],
);

export const chatWorkspaceFileRefs = pgTable(
  "chat_workspace_file_refs",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    workspaceFileId: uuid("workspace_file_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.workspaceFileId] }),
    index("chat_workspace_file_refs_file_idx").on(table.workspaceFileId),
  ],
);

export type ChatRow = typeof chats.$inferSelect;
export type ChatEventRow = typeof chatEvents.$inferSelect;
export type ChatAttachmentRow = typeof chatAttachments.$inferSelect;
export type ChatArtifactRow = typeof chatArtifacts.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type WorkspaceFolderRow = typeof workspaceFolders.$inferSelect;
export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect;
export type ParseJobRunRow = typeof parseJobRuns.$inferSelect;
export type AudioCaptureRow = typeof audioCaptures.$inferSelect;
export type AudioCapturePartRow = typeof audioCaptureParts.$inferSelect;
export type PlatformUserRow = typeof platformUsers.$inferSelect;
export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
export type UserIntegrationRow = typeof userIntegrations.$inferSelect;

export const scheduledTasks = pgTable(
  "scheduled_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull().default("omni"),
    name: text("name"),
    prompt: text("prompt").notNull(),
    everyMinutes: integer("every_minutes"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    enabled: boolean("enabled").notNull().default(true),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    lastChatId: uuid("last_chat_id").references(() => chats.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scheduled_tasks_due_idx")
      .on(table.nextRunAt)
      .where(sql`${table.deletedAt} is null and ${table.enabled} = true`),
    index("scheduled_tasks_user_updated_idx")
      .on(table.userId, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
  ],
);

export type ScheduledTaskRow = typeof scheduledTasks.$inferSelect;
