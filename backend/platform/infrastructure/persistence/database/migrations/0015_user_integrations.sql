CREATE TABLE IF NOT EXISTS "user_integrations" (
  "user_id" text NOT NULL,
  "integration_id" text NOT NULL,
  "secrets_encrypted" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_integrations_pk" PRIMARY KEY ("user_id", "integration_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_integrations_user_idx"
  ON "user_integrations" ("user_id");
