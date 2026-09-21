CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text,
  "prompt" text NOT NULL,
  "every_minutes" integer,
  "next_run_at" timestamp with time zone NOT NULL,
  "timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "lease_token" text,
  "lease_expires_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "last_status" text,
  "last_error" text,
  "last_chat_id" uuid,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_last_chat_id_chats_id_fk" FOREIGN KEY ("last_chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_tasks_due_idx" ON "scheduled_tasks" USING btree ("next_run_at") WHERE "scheduled_tasks"."deleted_at" is null AND "scheduled_tasks"."enabled" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_tasks_user_updated_idx" ON "scheduled_tasks" USING btree ("user_id","updated_at" DESC NULLS LAST) WHERE "scheduled_tasks"."deleted_at" is null;
