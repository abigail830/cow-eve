CREATE TABLE "chat_events" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"emitted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"eve_session_id" text NOT NULL,
	"title" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chats_eve_session_id_unique" UNIQUE("eve_session_id")
);
--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_events_chat_emitted_idx" ON "chat_events" USING btree ("chat_id","emitted_at");--> statement-breakpoint
CREATE INDEX "chats_user_agent_updated_idx" ON "chats" USING btree ("user_id","agent_id","updated_at" DESC NULLS LAST) WHERE "chats"."deleted_at" is null;