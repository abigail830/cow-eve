CREATE TABLE IF NOT EXISTS "platform_users" (
  "email" text PRIMARY KEY,
  "display_name" text NOT NULL,
  "password_hash" text NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
