-- Phase 1C.3: immutable, tenant-bound receipt evidence metadata.
CREATE TABLE "receipt_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "expense_id" UUID,
  "storage_key" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
  "upload_expires_at" TIMESTAMP(3) NOT NULL,
  "verified_at" TIMESTAMP(3),
  "retention_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "receipt_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_evidence_byte_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  CONSTRAINT "receipt_evidence_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "receipt_evidence_status_check" CHECK ("status" IN ('PENDING_UPLOAD','UPLOADED','ATTACHED','REJECTED','EXPIRED'))
);

CREATE UNIQUE INDEX "receipt_evidence_storage_key_key" ON "receipt_evidence"("storage_key");
CREATE INDEX "receipt_evidence_expense_id_idx" ON "receipt_evidence"("expense_id");
CREATE INDEX "receipt_evidence_org_business_created_idx" ON "receipt_evidence"("organization_id","business_id","created_at");
CREATE INDEX "receipt_evidence_user_created_idx" ON "receipt_evidence"("user_id","created_at");
CREATE INDEX "receipt_evidence_status_expiry_idx" ON "receipt_evidence"("status","upload_expires_at");

ALTER TABLE "receipt_evidence"
  ADD CONSTRAINT "receipt_evidence_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "orgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "receipt_evidence_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "receipt_evidence_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "receipt_evidence_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
