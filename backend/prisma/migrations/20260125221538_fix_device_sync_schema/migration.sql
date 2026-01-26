-- Fix Device Sync Schema: Add missing fields and update field names

-- AlterTable: Add deviceId unique field to devices table
ALTER TABLE "devices" ADD COLUMN "device_id" TEXT;

-- Backfill device_id with id values for existing records (if any)
UPDATE "devices" SET "device_id" = "id" WHERE "device_id" IS NULL;

-- Make device_id NOT NULL after backfill
ALTER TABLE "devices" ALTER COLUMN "device_id" SET NOT NULL;

-- Add unique constraint on device_id
CREATE UNIQUE INDEX "devices_device_id_key" ON "devices"("device_id");

-- Add lastHeartbeat field (duplicate of lastSeenAt for API compatibility)
ALTER TABLE "devices" ADD COLUMN "last_heartbeat" TIMESTAMP(3);

-- Backfill last_heartbeat from last_seen_at
UPDATE "devices" SET "last_heartbeat" = "last_seen_at" WHERE "last_heartbeat" IS NULL;

-- Make last_heartbeat NOT NULL
ALTER TABLE "devices" ALTER COLUMN "last_heartbeat" SET NOT NULL;

-- Add active field to devices
ALTER TABLE "devices" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Add device_id index
CREATE INDEX "devices_device_id_idx" ON "devices"("device_id");

-- Add composite index for active + lastHeartbeat
CREATE INDEX "devices_active_last_heartbeat_idx" ON "devices"("active", "last_heartbeat");

-- AlterTable: Add missing fields to sync_jobs
ALTER TABLE "sync_jobs" ADD COLUMN "operation" TEXT;
ALTER TABLE "sync_jobs" ADD COLUMN "result" JSONB;
ALTER TABLE "sync_jobs" ADD COLUMN "started_at" TIMESTAMP(3);
ALTER TABLE "sync_jobs" ADD COLUMN "completed_at" TIMESTAMP(3);

-- Update status enum values to lowercase
UPDATE "sync_jobs" SET "status" = LOWER("status");

-- Backfill operation from entity/action if NULL
UPDATE "sync_jobs" SET "operation" = 'push' WHERE "operation" IS NULL;

-- Make operation NOT NULL
ALTER TABLE "sync_jobs" ALTER COLUMN "operation" SET NOT NULL;

-- Add new indexes for sync_jobs
CREATE INDEX "sync_jobs_device_id_status_idx" ON "sync_jobs"("device_id", "status");
CREATE INDEX "sync_jobs_status_created_at_idx" ON "sync_jobs"("status", "created_at");
CREATE INDEX "sync_jobs_operation_status_idx" ON "sync_jobs"("operation", "status");

-- AlterTable: Update conflicts table
ALTER TABLE "conflicts" ADD COLUMN "device_id" UUID;
ALTER TABLE "conflicts" RENAME COLUMN "client_version" TO "local_version";
ALTER TABLE "conflicts" RENAME COLUMN "server_version" TO "server_version";
ALTER TABLE "conflicts" RENAME COLUMN "client_data" TO "local_data";
ALTER TABLE "conflicts" RENAME COLUMN "server_data" TO "server_data";

-- For existing conflicts (if any), set device_id from the first sync_job deviceId for that user
-- This is a best-effort backfill
UPDATE "conflicts" c
SET "device_id" = (
  SELECT sj."device_id"
  FROM "sync_jobs" sj
  WHERE sj."user_id" = c."user_id"
  LIMIT 1
)
WHERE "device_id" IS NULL;

-- If still NULL, use first device for that user
UPDATE "conflicts" c
SET "device_id" = (
  SELECT d."id"
  FROM "devices" d
  WHERE d."user_id" = c."user_id"
  LIMIT 1
)
WHERE "device_id" IS NULL;

-- Make device_id NOT NULL (will fail if there are conflicts without users having devices)
ALTER TABLE "conflicts" ALTER COLUMN "device_id" SET NOT NULL;

-- Add device_id foreign key constraint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old resolution column type and recreate as TEXT (not db.Text)
ALTER TABLE "conflicts" ALTER COLUMN "resolution" TYPE TEXT;

-- Add new indexes for conflicts
CREATE INDEX "conflicts_device_id_idx" ON "conflicts"("device_id");
CREATE INDEX "conflicts_resolution_idx" ON "conflicts"("resolution");
