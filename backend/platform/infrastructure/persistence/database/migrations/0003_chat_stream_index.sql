ALTER TABLE "chats" ADD COLUMN "eve_stream_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "chats" AS c
SET "eve_stream_index" = COALESCE(
  (SELECT COUNT(*)::int FROM "chat_events" AS e WHERE e."chat_id" = c."id"),
  0
);
