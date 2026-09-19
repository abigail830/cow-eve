CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
