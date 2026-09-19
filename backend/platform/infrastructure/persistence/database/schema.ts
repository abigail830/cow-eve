import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
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

/** Singleton (and future) platform config rows — e.g. id = "model". */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ChatRow = typeof chats.$inferSelect;
export type ChatEventRow = typeof chatEvents.$inferSelect;
export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
