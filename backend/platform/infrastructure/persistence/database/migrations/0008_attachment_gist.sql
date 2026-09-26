ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist_content_sha256" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist_generated_at" timestamp with time zone;
