-- Track object-store retention purge completion without deleting the evidence/audit row.
ALTER TABLE "receipt_evidence"
  ADD COLUMN "objects_purged_at" TIMESTAMP(3);

CREATE INDEX "receipt_evidence_retention_cleanup_idx"
  ON "receipt_evidence"("objects_purged_at", "retention_until");
