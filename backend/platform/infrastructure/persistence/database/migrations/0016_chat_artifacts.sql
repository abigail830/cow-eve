CREATE TABLE IF NOT EXISTS "chat_artifacts" (
  "chat_id" uuid NOT NULL,
  "artifact_id" text NOT NULL,
  "user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "filename" text NOT NULL,
  "title" text NOT NULL,
  "kind" text NOT NULL,
  "format" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_artifacts_chat_id_artifact_id_pk" PRIMARY KEY ("chat_id", "artifact_id")
);
--> statement-breakpoint
ALTER TABLE "chat_artifacts" ADD CONSTRAINT "chat_artifacts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_artifacts_user_agent_created_idx" ON "chat_artifacts" USING btree ("user_id", "agent_id", "created_at" DESC);
