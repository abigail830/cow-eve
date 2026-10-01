CREATE TABLE IF NOT EXISTS "chat_workspace_file_refs" (
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "workspace_file_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_workspace_file_refs_pk" PRIMARY KEY ("chat_id", "workspace_file_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_workspace_file_refs_file_idx"
  ON "chat_workspace_file_refs" ("workspace_file_id");
