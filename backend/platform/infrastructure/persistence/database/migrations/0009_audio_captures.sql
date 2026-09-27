CREATE TABLE IF NOT EXISTS "audio_captures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "output_attachment_id" uuid NOT NULL REFERENCES "chat_attachments"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audio_captures_chat_created_idx"
  ON "audio_captures" ("chat_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_capture_parts" (
  "capture_id" uuid NOT NULL REFERENCES "audio_captures"("id") ON DELETE CASCADE,
  "attachment_id" uuid NOT NULL REFERENCES "chat_attachments"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("capture_id", "attachment_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audio_capture_parts_attachment_idx"
  ON "audio_capture_parts" ("attachment_id");
