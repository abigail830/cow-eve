CREATE TABLE IF NOT EXISTS "agent_integrations" (
  "user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "integration_id" text NOT NULL,
  "secrets_encrypted" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_integrations_pk" PRIMARY KEY ("user_id", "agent_id", "integration_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_integrations_user_agent_idx"
  ON "agent_integrations" ("user_id", "agent_id");
