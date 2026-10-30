-- Phase 1C.5: client-generated idempotency key makes upload-intent creation recoverable.
ALTER TABLE "receipt_evidence"
  ADD COLUMN "client_upload_id" UUID;

CREATE UNIQUE INDEX "receipt_evidence_client_upload_id_key"
  ON "receipt_evidence"("client_upload_id");
