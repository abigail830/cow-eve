ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist" text;
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist_content_sha256" text;
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "gist_generated_at" timestamp with time zone;
