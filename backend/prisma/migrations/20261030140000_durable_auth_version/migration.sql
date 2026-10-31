-- Store session revocation state durably; Redis is only used for refresh-token delivery state.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_version" INTEGER NOT NULL DEFAULT 0;
