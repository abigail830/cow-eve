CREATE TABLE IF NOT EXISTS "user_agent_kb_preferences" (
  "user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "disabled_kb_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_agent_kb_preferences_pk" PRIMARY KEY ("user_id", "agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_kb_preferences" (
  "project_id" uuid NOT NULL,
  "disabled_kb_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "project_kb_preferences_pk" PRIMARY KEY ("project_id")
);
--> statement-breakpoint
ALTER TABLE "project_kb_preferences" ADD CONSTRAINT "project_kb_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
