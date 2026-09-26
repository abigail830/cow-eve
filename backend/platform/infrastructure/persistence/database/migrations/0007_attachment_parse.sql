ALTER TABLE "chat_attachments"
  ADD COLUMN IF NOT EXISTS "content_hash" text,
  ADD COLUMN IF NOT EXISTS "parse_status" text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "parse_pipeline_id" text,
  ADD COLUMN IF NOT EXISTS "parse_job_id" text,
  ADD COLUMN IF NOT EXISTS "parse_error_code" text,
  ADD COLUMN IF NOT EXISTS "parse_error_message" text,
  ADD COLUMN IF NOT EXISTS "parse_stage_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "parsed_artifact_manifest" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parse_job_runs" (
  "job_id" text PRIMARY KEY,
  "attachment_id" uuid NOT NULL REFERENCES "chat_attachments"("id") ON DELETE CASCADE,
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "run_token_hash" text NOT NULL,
  "webhook_secret" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "job_payload_json" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parse_job_runs_attachment_idx"
  ON "parse_job_runs" ("attachment_id");
