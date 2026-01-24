-- ============================================
-- Rollback Script for Device Sync Migration
-- ============================================
-- This script safely removes all device sync tables and columns
-- Run this ONLY if you need to rollback the add-device-sync migration
-- 
-- CAUTION: This will delete all sync-related data!
-- 
-- Usage (PostgreSQL):
-- psql -d your_database < scripts/rollback-device-sync.sql

BEGIN;

-- Drop dependent tables in correct order to avoid FK constraint violations
DROP TABLE IF EXISTS "admin_actions" CASCADE;
DROP TABLE IF EXISTS "ocr_jobs" CASCADE;
DROP TABLE IF EXISTS "invoice_versions" CASCADE;
DROP TABLE IF EXISTS "conflicts" CASCADE;
DROP TABLE IF EXISTS "sync_jobs" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "user_consents" CASCADE;
DROP TABLE IF EXISTS "alerts" CASCADE;

-- Remove version column from invoices
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "version";

-- Remove added User columns (be careful - some may have been added earlier)
-- Only uncomment these if you're certain they were added by this migration
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "email";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_token";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_token_expiry";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "verified";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_enabled";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_secret";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_temp_secret";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_device";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "duplo_client_id";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "duplo_client_secret";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "remita_merchant_id";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "remita_api_key";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "ecdsa_private_key";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_at";

COMMIT;

-- Verify tables are dropped
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('devices', 'sync_jobs', 'conflicts', 'invoice_versions', 'ocr_jobs', 'admin_actions', 'user_consents', 'alerts');
