-- Persist all business profile fields already collected by the mobile application.
ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "trading_name" TEXT,
  ADD COLUMN IF NOT EXISTS "sector" TEXT,
  ADD COLUMN IF NOT EXISTS "annual_turnover" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "monthly_revenue" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "total_fixed_assets" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "employee_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_vat_registered" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "vat_number" TEXT,
  ADD COLUMN IF NOT EXISTS "address_lga" TEXT;
