-- Bind businesses to an organization before enabling tenant-scoped offline CRUD.
ALTER TABLE "businesses" ADD COLUMN "org_id" UUID;

-- Safe legacy backfill only where the owner has exactly one active membership.
-- Ambiguous/unmapped rows remain NULL and are intentionally ineligible for offline writes.
WITH unique_membership AS (
  SELECT "user_id", (ARRAY_AGG("org_id" ORDER BY "org_id"))[1] AS "org_id"
  FROM "org_members"
  WHERE "status" = 'active'
  GROUP BY "user_id"
  HAVING COUNT(*) = 1
)
UPDATE "businesses" AS b
SET "org_id" = m."org_id"
FROM unique_membership AS m
WHERE b."owner_id" = m."user_id"
  AND b."org_id" IS NULL;

ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "orgs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "businesses_org_id_idx" ON "businesses"("org_id");

-- Durable idempotency receipt for transactional domain handlers.
CREATE TABLE "operation_effects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payload_fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_effects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "operation_effects_operation_id_key" ON "operation_effects"("operation_id");
CREATE INDEX "operation_effects_organization_id_created_at_idx" ON "operation_effects"("organization_id", "created_at");
