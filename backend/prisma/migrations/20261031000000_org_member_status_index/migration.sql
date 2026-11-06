-- Index fields used to resolve active organization memberships.
-- The status column was added by the Phase 1A operation-integrity migration.
CREATE INDEX IF NOT EXISTS "org_members_org_status_removed_at_idx"
  ON "org_members" ("org_id", "status", "removed_at");
