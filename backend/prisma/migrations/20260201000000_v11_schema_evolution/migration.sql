-- V11.1 Schema Evolution Migration
-- Phase 2 (P2): New models + Phase 3 (P3): User role field
-- Safe migration: all new columns have defaults, all new tables are additive

-- P3: Add role column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'owner';

-- P2: OnboardingProgress table
CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "current_step" TEXT NOT NULL DEFAULT 'welcome',
  "completed_steps" TEXT[] NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_user_id_key" ON "onboarding_progress"("user_id");

ALTER TABLE "onboarding_progress"
  DROP CONSTRAINT IF EXISTS "onboarding_progress_user_id_fkey",
  ADD CONSTRAINT "onboarding_progress_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- P2: DLQJob table (event bus dead letter queue)
CREATE TABLE IF NOT EXISTS "dlq_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_name" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "error" TEXT NOT NULL,
  "handler_name" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "retry_count" INT NOT NULL DEFAULT 0,
  "max_retries" INT NOT NULL DEFAULT 3,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_retry_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),

  CONSTRAINT "dlq_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dlq_jobs_status_idx" ON "dlq_jobs"("status");
CREATE INDEX IF NOT EXISTS "dlq_jobs_event_name_idx" ON "dlq_jobs"("event_name");
CREATE INDEX IF NOT EXISTS "dlq_jobs_idempotency_key_idx" ON "dlq_jobs"("idempotency_key");

-- P2: UserSession table (RBAC session management)
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "device_info" TEXT,
  "ip_address" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoked_by" UUID,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_token_hash_idx" ON "user_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_is_active_idx" ON "user_sessions"("is_active");

ALTER TABLE "user_sessions"
  DROP CONSTRAINT IF EXISTS "user_sessions_user_id_fkey",
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- P2: AcademyNudge table (tax education nudges)
CREATE TABLE IF NOT EXISTS "academy_nudges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "nudge_type" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_pidgin" TEXT NOT NULL,
  "body_en" TEXT NOT NULL,
  "body_pidgin" TEXT NOT NULL,
  "action_url" TEXT,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "shown_at" TIMESTAMP(3),
  "dismissed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "academy_nudges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "academy_nudges_user_id_idx" ON "academy_nudges"("user_id");
CREATE INDEX IF NOT EXISTS "academy_nudges_dismissed_idx" ON "academy_nudges"("dismissed");

ALTER TABLE "academy_nudges"
  DROP CONSTRAINT IF EXISTS "academy_nudges_user_id_fkey",
  ADD CONSTRAINT "academy_nudges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
