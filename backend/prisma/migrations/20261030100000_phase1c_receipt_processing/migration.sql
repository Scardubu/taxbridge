-- Phase 1C.4: quarantine scanning and evidence-only OCR processing.
ALTER TABLE "receipt_evidence"
  ADD COLUMN "clean_storage_key" TEXT,
  ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewed_by" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  DROP CONSTRAINT "receipt_evidence_status_check",
  ADD CONSTRAINT "receipt_evidence_status_check"
    CHECK ("status" IN ('PENDING_UPLOAD','UPLOADED','QUARANTINED','SCANNING','CLEAN','INFECTED','SCAN_FAILED','ATTACHED','REJECTED','EXPIRED'));

CREATE UNIQUE INDEX "receipt_evidence_clean_storage_key_key" ON "receipt_evidence"("clean_storage_key");
ALTER TABLE "receipt_evidence" ADD CONSTRAINT "receipt_evidence_review_status_check"
  CHECK ("review_status" IN ('PENDING','REQUIRED','ACCEPTED','REJECTED'));
ALTER TABLE "receipt_evidence" ADD CONSTRAINT "receipt_evidence_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "receipt_processing_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receipt_evidence_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "receipt_processing_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_processing_jobs_status_check" CHECK ("status" IN ('PENDING','PROCESSING','RETRY','COMPLETED','DEAD_LETTER')),
  CONSTRAINT "receipt_processing_jobs_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "receipt_processing_jobs_receipt_fkey"
    FOREIGN KEY ("receipt_evidence_id") REFERENCES "receipt_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "receipt_processing_jobs_receipt_key" ON "receipt_processing_jobs"("receipt_evidence_id");
CREATE INDEX "receipt_processing_jobs_dispatch_idx" ON "receipt_processing_jobs"("status","available_at","created_at");

CREATE TABLE "receipt_scan_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receipt_evidence_id" UUID NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "engine" TEXT NOT NULL,
  "engine_version" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "findings" JSONB NOT NULL DEFAULT '[]',
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_scan_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_scan_results_receipt_fkey"
    FOREIGN KEY ("receipt_evidence_id") REFERENCES "receipt_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipt_scan_results_verdict_check" CHECK ("verdict" IN ('CLEAN','INFECTED'))
);
CREATE UNIQUE INDEX "receipt_scan_results_receipt_key" ON "receipt_scan_results"("receipt_evidence_id");

CREATE TABLE "receipt_ocr_extractions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receipt_evidence_id" UUID NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_version" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "extracted_text" TEXT,
  "mean_confidence" DOUBLE PRECISION,
  "field_candidates" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_ocr_extractions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_ocr_extractions_receipt_fkey"
    FOREIGN KEY ("receipt_evidence_id") REFERENCES "receipt_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipt_ocr_extractions_status_check" CHECK ("status" IN ('SUCCEEDED','FAILED','UNAVAILABLE')),
  CONSTRAINT "receipt_ocr_extractions_confidence_check" CHECK ("mean_confidence" IS NULL OR ("mean_confidence" >= 0 AND "mean_confidence" <= 1))
);
CREATE UNIQUE INDEX "receipt_ocr_extractions_receipt_key" ON "receipt_ocr_extractions"("receipt_evidence_id");

-- Existing Phase 1C.3 UPLOADED rows have only passed byte/signature checks.
-- Re-quarantine them and enqueue a scan before allowing future attachment.
UPDATE "receipt_evidence" SET "status" = 'QUARANTINED' WHERE "status" IN ('UPLOADED','ATTACHED');
INSERT INTO "receipt_processing_jobs" ("receipt_evidence_id", "status", "updated_at")
SELECT "id", 'PENDING', CURRENT_TIMESTAMP
FROM "receipt_evidence"
WHERE "status" = 'QUARANTINED'
ON CONFLICT ("receipt_evidence_id") DO NOTHING;

ALTER TABLE "receipt_evidence" DROP CONSTRAINT "receipt_evidence_status_check";
ALTER TABLE "receipt_evidence" ADD CONSTRAINT "receipt_evidence_status_check"
  CHECK ("status" IN ('PENDING_UPLOAD','QUARANTINED','SCANNING','CLEAN','INFECTED','SCAN_FAILED','ATTACHED','REJECTED','EXPIRED'));
