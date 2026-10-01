-- 0012 dropped a legacy constraint name; Postgres may still have parse_job_runs_attachment_id_fkey.
ALTER TABLE "parse_job_runs" DROP CONSTRAINT IF EXISTS "parse_job_runs_attachment_id_fkey";
--> statement-breakpoint
ALTER TABLE "parse_job_runs" DROP CONSTRAINT IF EXISTS "parse_job_runs_attachment_id_chat_attachments_id_fk";
