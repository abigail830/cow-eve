CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "name" text NOT NULL,
  "instructions" text DEFAULT '' NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_user_agent_updated_idx" ON "projects" USING btree ("user_id", "agent_id", "updated_at" DESC) WHERE "projects"."deleted_at" is null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_workspace_file_refs" (
  "project_id" uuid NOT NULL,
  "workspace_file_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_workspace_file_refs_pk" PRIMARY KEY ("project_id", "workspace_file_id")
);
--> statement-breakpoint
ALTER TABLE "project_workspace_file_refs" ADD CONSTRAINT "project_workspace_file_refs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_workspace_file_refs" ADD CONSTRAINT "project_workspace_file_refs_workspace_file_id_workspace_files_id_fk" FOREIGN KEY ("workspace_file_id") REFERENCES "public"."workspace_files"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_workspace_file_refs_file_idx" ON "project_workspace_file_refs" ("workspace_file_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_session_bindings" (
  "eve_session_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "project_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_session_bindings" ADD CONSTRAINT "chat_session_bindings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "scheduled_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_scheduled_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("scheduled_task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_user_agent_project_idx" ON "chats" ("user_id", "agent_id", "project_id") WHERE "chats"."deleted_at" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_scheduled_task_idx" ON "chats" ("scheduled_task_id") WHERE "chats"."deleted_at" is null;
--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "agent_id" text DEFAULT 'omni' NOT NULL;
