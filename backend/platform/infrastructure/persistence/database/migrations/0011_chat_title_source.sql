ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "title_source" text;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "title_generated_at" timestamp with time zone;
