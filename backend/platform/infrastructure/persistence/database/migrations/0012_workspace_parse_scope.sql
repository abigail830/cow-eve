ALTER TABLE "parse_job_runs" ADD COLUMN IF NOT EXISTS "source_kind" text NOT NULL DEFAULT 'chat_attachment';
--> statement-breakpoint
ALTER TABLE "parse_job_runs" ADD COLUMN IF NOT EXISTS "scope_id" text;
--> statement-breakpoint
UPDATE "parse_job_runs" SET "scope_id" = "chat_id"::text WHERE "scope_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "parse_job_runs" ALTER COLUMN "scope_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "parse_job_runs" DROP CONSTRAINT IF EXISTS "parse_job_runs_attachment_id_chat_attachments_id_fk";
--> statement-breakpoint
ALTER TABLE "parse_job_runs" DROP CONSTRAINT IF EXISTS "parse_job_runs_chat_id_chats_id_fk";
--> statement-breakpoint
ALTER TABLE "parse_job_runs" ALTER COLUMN "chat_id" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_folders_user_name_idx" ON "workspace_folders" ("user_id", "name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "folder_id" uuid NOT NULL REFERENCES "workspace_folders"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "media_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "content_hash" text,
  "parse_status" text DEFAULT 'ready' NOT NULL,
  "parse_pipeline_id" text,
  "parse_job_id" text,
  "parse_error_code" text,
  "parse_error_message" text,
  "parse_stage_snapshot" jsonb,
  "parsed_artifact_manifest" jsonb,
  "gist" text,
  "gist_content_sha256" text,
  "gist_generated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_files_folder_filename_idx" ON "workspace_files" ("folder_id", "filename");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_files_user_idx" ON "workspace_files" ("user_id");
