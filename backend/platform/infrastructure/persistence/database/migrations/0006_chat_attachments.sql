CREATE TABLE IF NOT EXISTS "chat_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" uuid NOT NULL,
  "filename" text NOT NULL,
  "media_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_attachments_chat_created_idx" ON "chat_attachments" USING btree ("chat_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_attachments_chat_filename_idx" ON "chat_attachments" USING btree ("chat_id","filename");
