-- Fence receipt completion against concurrent retention expiry.
ALTER TABLE "receipt_evidence"
  ADD COLUMN "verification_started_at" TIMESTAMP(3);

CREATE INDEX "receipt_evidence_verification_lease_idx"
  ON "receipt_evidence"("status", "verification_started_at", "upload_expires_at");
