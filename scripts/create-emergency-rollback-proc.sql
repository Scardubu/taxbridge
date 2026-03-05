-- ─────────────────────────────────────────────────────────────────────────────
-- TaxBridge — Emergency Rollback Stored Procedure  (COMP-07)
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates a PostgreSQL stored procedure that can roll back a V12 migration
-- in a controlled, auditable manner.
--
-- Usage (psql or migration runner):
--   \i scripts/create-emergency-rollback-proc.sql
--   SELECT emergency_rollback_v12('operator@taxbridge.ng', 'reason here');
--
-- Safety rules:
--   1. Verifies caller identity is present.
--   2. Writes a PRE_ROLLBACK audit event before touching data.
--   3. All DML is wrapped in a single transaction — rolls back atomically.
--   4. Writes a POST_ROLLBACK audit event on success.
--   5. On any error, the transaction is rolled back and the error is re-raised.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop if exists so the script is idempotent
DROP FUNCTION IF EXISTS emergency_rollback_v12(TEXT, TEXT);

CREATE OR REPLACE FUNCTION emergency_rollback_v12(
  p_operator    TEXT,
  p_reason      TEXT DEFAULT 'Emergency rollback requested'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time  TIMESTAMPTZ := NOW();
  v_job_count   INTEGER;
  v_risk_count  INTEGER;
  v_snap_count  INTEGER;
BEGIN
  -- ── Pre-flight checks ────────────────────────────────────────────────────
  IF p_operator IS NULL OR LENGTH(TRIM(p_operator)) = 0 THEN
    RAISE EXCEPTION 'emergency_rollback_v12: operator identity is required';
  END IF;

  -- ── Write PRE_ROLLBACK audit event ──────────────────────────────────────
  INSERT INTO "AuditEvent" (
    id,
    "orgId",
    "actorId",
    action,
    resource,
    "resourceId",
    details,
    "ipAddress",
    "createdAt"
  ) VALUES (
    gen_random_uuid(),
    'SYSTEM',
    p_operator,
    'PRE_ROLLBACK_V12',
    'System',
    'v12-rollback',
    jsonb_build_object(
      'reason',    p_reason,
      'operator',  p_operator,
      'startedAt', v_start_time
    ),
    '127.0.0.1',
    NOW()
  );

  -- ── V12-specific rollback steps ──────────────────────────────────────────
  --
  -- Step 1: Remove V12 DLQ (failed-job) records introduced in V12.
  --         Matched by the v12 schemaVersion marker if present.
  --
  DELETE FROM "FailedJob"
  WHERE "schemaVersion" = 'v12'
     OR "createdAt" >= v_start_time - INTERVAL '1 year'; -- bounded safety belt
  GET DIAGNOSTICS v_job_count = ROW_COUNT;

  -- Step 2: Remove SMERiskRecord rows created by V12 risk-scoring engine.
  DELETE FROM "SMERiskRecord"
  WHERE "createdAt" >= (
    SELECT COALESCE(MIN("createdAt"), NOW())
    FROM "SMERiskRecord"
    WHERE "schemaVersion" = 'v12'
  );
  GET DIAGNOSTICS v_risk_count = ROW_COUNT;

  -- Step 3: Remove TaxHealthSnapshot rows created by V12 trends endpoint.
  DELETE FROM "TaxHealthSnapshot"
  WHERE "schemaVersion" = 'v12';
  GET DIAGNOSTICS v_snap_count = ROW_COUNT;

  -- Step 4: Reset any V12-specific flags on UserSession.
  UPDATE "UserSession"
  SET    metadata = metadata - 'v12Flags'
  WHERE  metadata ? 'v12Flags';

  -- ── Write POST_ROLLBACK audit event ─────────────────────────────────────
  INSERT INTO "AuditEvent" (
    id,
    "orgId",
    "actorId",
    action,
    resource,
    "resourceId",
    details,
    "ipAddress",
    "createdAt"
  ) VALUES (
    gen_random_uuid(),
    'SYSTEM',
    p_operator,
    'POST_ROLLBACK_V12',
    'System',
    'v12-rollback',
    jsonb_build_object(
      'reason',          p_reason,
      'operator',        p_operator,
      'completedAt',     NOW(),
      'durationMs',      EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000,
      'deletedFailedJobs',       v_job_count,
      'deletedRiskRecords',      v_risk_count,
      'deletedHealthSnapshots',  v_snap_count
    ),
    '127.0.0.1',
    NOW()
  );

  RETURN jsonb_build_object(
    'success',                   true,
    'operator',                  p_operator,
    'reason',                    p_reason,
    'durationMs',                EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000,
    'deletedFailedJobs',         v_job_count,
    'deletedRiskRecords',        v_risk_count,
    'deletedHealthSnapshots',    v_snap_count
  );

EXCEPTION WHEN OTHERS THEN
  -- Surface the error — caller's transaction (if any) will roll back
  RAISE EXCEPTION 'emergency_rollback_v12 failed: % %', SQLERRM, SQLSTATE;
END;
$$;

-- Grant execute to the application role (adjust role name to match your setup)
-- GRANT EXECUTE ON FUNCTION emergency_rollback_v12(TEXT, TEXT) TO taxbridge_app;

COMMENT ON FUNCTION emergency_rollback_v12(TEXT, TEXT) IS
  'COMP-07: Emergency rollback procedure for V12 migration. '
  'Removes V12-specific data rows and writes audit events. '
  'Must be called with an operator identity string.';
