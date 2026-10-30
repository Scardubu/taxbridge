-- TaxBridge Phase 1A: additive persistence changes.
-- Existing v1 columns and tables are preserved.
ALTER TABLE "org_members"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS "sync_operations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "device_id" TEXT,
  "operation_id" UUID NOT NULL,
  "operation_type" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_fingerprint" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3),
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "acknowledged_at" TIMESTAMP(3),
  "result" JSONB,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "provider_reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sync_operations_idempotency_unique"
  ON "sync_operations"("organization_id", "operation_type", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "sync_operations_operation_id_unique"
  ON "sync_operations"("operation_id");
CREATE INDEX IF NOT EXISTS "sync_operations_status_next_attempt_idx"
  ON "sync_operations"("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "sync_operations_organization_created_idx"
  ON "sync_operations"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "sync_operations_deadline_status_idx"
  ON "sync_operations"("deadline_at", "status");

CREATE TABLE IF NOT EXISTS "operation_outbox" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "dispatched_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operation_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "operation_outbox_operation_topic_unique"
  ON "operation_outbox"("operation_id", "topic");
CREATE INDEX IF NOT EXISTS "operation_outbox_dispatched_created_idx"
  ON "operation_outbox"("dispatched_at", "created_at");

CREATE TABLE IF NOT EXISTS "operation_dead_letters" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "device_id" TEXT,
  "operation_type" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_fingerprint" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempt_count" INTEGER NOT NULL,
  "failure_code" TEXT NOT NULL,
  "failure_reason" TEXT NOT NULL,
  "provider_reference" TEXT,
  "resolution_status" TEXT NOT NULL DEFAULT 'unresolved',
  "resolved_by" UUID,
  "resolution_reason" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operation_dead_letters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "operation_dead_letters_operation_id_key"
  ON "operation_dead_letters"("operation_id");
CREATE INDEX IF NOT EXISTS "operation_dead_letters_org_resolution_created_idx"
  ON "operation_dead_letters"("organization_id", "resolution_status", "created_at");
CREATE INDEX IF NOT EXISTS "operation_dead_letters_type_resolution_idx"
  ON "operation_dead_letters"("operation_type", "resolution_status");
