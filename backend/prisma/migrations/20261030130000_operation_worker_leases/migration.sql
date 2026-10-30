-- Persist worker ownership separately from BullMQ delivery state.
ALTER TABLE "sync_operations"
  ADD COLUMN IF NOT EXISTS "processing_lease_token" UUID,
  ADD COLUMN IF NOT EXISTS "processing_lease_until" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "sync_operations_processing_lease_idx"
  ON "sync_operations" ("status", "processing_lease_until")
  WHERE "status" = 'processing';

-- Re-open pending outbox rows created by the previous dispatcher, which
-- acknowledged Redis insertion rather than a durable worker claim. Jobs are
-- re-created idempotently using the outbox row ID.
UPDATE "operation_outbox" AS outbox
SET "dispatched_at" = NULL
FROM "sync_operations" AS operation
WHERE outbox."operation_id" = operation."operation_id"
  AND operation."status" IN ('pending', 'retry_scheduled');
