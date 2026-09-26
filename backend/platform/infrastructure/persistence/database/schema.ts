import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
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

export const parseJobRuns = pgTable(
  "parse_job_runs",
  {
    jobId: text("job_id").primaryKey(),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => chatAttachments.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
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

export type ChatRow = typeof chats.$inferSelect;
export type ChatEventRow = typeof chatEvents.$inferSelect;
export type ChatAttachmentRow = typeof chatAttachments.$inferSelect;
export type ParseJobRunRow = typeof parseJobRuns.$inferSelect;
export type PlatformUserRow = typeof platformUsers.$inferSelect;
export type PlatformSettingsRow = typeof platformSettings.$inferSelect;

export const scheduledTasks = pgTable(
  "scheduled_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
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
