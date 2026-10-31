-- Phase 1C.6 — invoice lifecycle governance.
-- Approval is an internal control only. It does not submit, stamp, send, pay, or file an invoice.
-- This migration is intentionally additive: legacy invoice status and delivery data are preserved.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "invoices"
  ADD COLUMN "approval_status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "submitted_for_approval_at" TIMESTAMP(3),
  ADD COLUMN "approved_by" UUID,
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_version" INTEGER,
  ADD COLUMN "rejected_by" UUID,
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" TEXT;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_approval_status_check"
    CHECK ("approval_status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT "invoices_approved_version_check"
    CHECK (
      "approved_version" IS NULL
      OR ("approved_version" > 0 AND "approved_version" <= "version")
    ),
  ADD CONSTRAINT "invoices_approval_state_fields_check"
    CHECK (
      (
        "approval_status" = 'DRAFT'
        AND "submitted_for_approval_at" IS NULL
        AND "approved_by" IS NULL
        AND "approved_at" IS NULL
        AND "approved_version" IS NULL
        AND "rejected_by" IS NULL
        AND "rejected_at" IS NULL
        AND "rejection_reason" IS NULL
      )
      OR (
        "approval_status" = 'PENDING_APPROVAL'
        AND "submitted_for_approval_at" IS NOT NULL
        AND "approved_by" IS NULL
        AND "approved_at" IS NULL
        AND "approved_version" IS NULL
        AND "rejected_by" IS NULL
        AND "rejected_at" IS NULL
        AND "rejection_reason" IS NULL
      )
      OR (
        "approval_status" = 'APPROVED'
        AND "submitted_for_approval_at" IS NOT NULL
        AND "approved_by" IS NOT NULL
        AND "approved_at" IS NOT NULL
        AND "approved_version" = "version"
        AND "rejected_by" IS NULL
        AND "rejected_at" IS NULL
        AND "rejection_reason" IS NULL
      )
      OR (
        "approval_status" = 'REJECTED'
        AND "submitted_for_approval_at" IS NOT NULL
        AND "approved_by" IS NULL
        AND "approved_at" IS NULL
        AND "approved_version" IS NULL
        AND "rejected_by" IS NOT NULL
        AND "rejected_at" IS NOT NULL
        AND "rejection_reason" IS NOT NULL
        AND length(btrim("rejection_reason")) >= 10
      )
    );

ALTER TABLE "invoice_versions"
  ADD COLUMN "content_hash" CHAR(64),
  ADD CONSTRAINT "invoice_versions_content_hash_check"
    CHECK ("content_hash" IS NULL OR "content_hash" ~ '^[a-f0-9]{64}$');

CREATE TABLE "invoice_lifecycle_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "from_approval_status" TEXT,
  "to_approval_status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_lifecycle_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_lifecycle_events_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "invoice_lifecycle_events_status_check"
    CHECK ("to_approval_status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  CONSTRAINT "invoice_lifecycle_events_from_status_check"
    CHECK (
      "from_approval_status" IS NULL
      OR "from_approval_status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    ),
  CONSTRAINT "invoice_lifecycle_events_type_check"
    CHECK (
      "event_type" IN (
        'DRAFT_CREATED',
        'DRAFT_UPDATED',
        'SUBMITTED_FOR_APPROVAL',
        'APPROVED',
        'REJECTED',
        'DRAFT_REVISED_AFTER_REJECTION',
        'LEGACY_IMPORTED'
      )
    ),
  CONSTRAINT "invoice_lifecycle_events_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoice_lifecycle_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "orgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoice_lifecycle_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "invoice_lifecycle_invoice_occurred_idx"
  ON "invoice_lifecycle_events"("invoice_id", "occurred_at");
CREATE INDEX "invoice_lifecycle_org_occurred_idx"
  ON "invoice_lifecycle_events"("organization_id", "occurred_at");
CREATE INDEX "invoice_lifecycle_actor_occurred_idx"
  ON "invoice_lifecycle_events"("actor_user_id", "occurred_at");
CREATE INDEX "invoices_approval_status_business_idx"
  ON "invoices"("business_id", "approval_status", "updated_at");

-- Snapshot the current revision for legacy invoices that do not yet have one.
-- Existing revisions and invoice delivery fields are not rewritten.
INSERT INTO "invoice_versions" (
  "id", "invoice_id", "version", "data", "changed_by", "created_at"
)
SELECT
  gen_random_uuid(),
  i."id",
  GREATEST(i."version", 1),
  jsonb_build_object(
    'invoiceId', i."id",
    'version', GREATEST(i."version", 1),
    'approvalStatus', 'DRAFT',
    'businessId', i."business_id",
    'invoiceNumber', i."invoice_number",
    'customerName', i."customer_name",
    'customerTIN', i."customer_tin",
    'customerEmail', i."customer_email",
    'customerPhone', i."customer_phone",
    'customerAddress', i."customer_address",
    'items', i."items",
    'subtotal', i."subtotal"::text,
    'vat', i."vat"::text,
    'total', i."total"::text,
    'dueDate', i."due_date",
    'template', i."template",
    'notes', i."notes",
    'invoiceStatus', i."status"
  ),
  i."user_id"::text,
  i."created_at"
FROM "invoices" i
WHERE NOT EXISTS (
  SELECT 1
  FROM "invoice_versions" v
  WHERE v."invoice_id" = i."id"
    AND v."version" = GREATEST(i."version", 1)
)
ON CONFLICT ("invoice_id", "version") DO NOTHING;

-- Hash every existing and newly backfilled revision using PostgreSQL JSONB canonical text.
UPDATE "invoice_versions"
SET "content_hash" = encode(digest("data"::text, 'sha256'), 'hex')
WHERE "content_hash" IS NULL;

-- Tenant identity comes only from the invoice's owning business.
-- No approval, authorization, or NRS evidence is inferred for legacy invoices.
INSERT INTO "invoice_lifecycle_events" (
  "id", "invoice_id", "organization_id", "actor_user_id", "event_type",
  "from_approval_status", "to_approval_status", "revision", "reason", "metadata", "occurred_at"
)
SELECT
  gen_random_uuid(),
  i."id",
  b."org_id",
  i."user_id",
  'LEGACY_IMPORTED',
  NULL,
  'DRAFT',
  GREATEST(i."version", 1),
  'Imported during Phase 1C.6 lifecycle rollout',
  jsonb_build_object(
    'legacyStatus', i."status",
    'approvalEvidence', 'not_inferred'
  ),
  i."created_at"
FROM "invoices" i
JOIN "businesses" b ON b."id" = i."business_id"
WHERE b."org_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "invoice_lifecycle_events" e
    WHERE e."invoice_id" = i."id"
  );

-- Revisions and lifecycle events are immutable audit evidence.
CREATE OR REPLACE FUNCTION taxbridge_reject_invoice_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Invoice revision and lifecycle history is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "invoice_versions_append_only"
  BEFORE UPDATE OR DELETE ON "invoice_versions"
  FOR EACH ROW EXECUTE FUNCTION taxbridge_reject_invoice_history_mutation();

CREATE TRIGGER "invoice_lifecycle_events_append_only"
  BEFORE UPDATE OR DELETE ON "invoice_lifecycle_events"
  FOR EACH ROW EXECUTE FUNCTION taxbridge_reject_invoice_history_mutation();
