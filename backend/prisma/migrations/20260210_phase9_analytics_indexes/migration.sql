-- Phase 9: Analytics & Performance Optimization Indexes
-- Date: 2026-02-10
-- Purpose: Add compound indexes for dashboard analytics and reporting queries

-- ============================================
-- Business Analytics Indexes
-- ============================================

-- Active businesses count by status (using snake_case column names)
CREATE INDEX IF NOT EXISTS "businesses_status_created_at_idx" 
ON "businesses"("status", "created_at" DESC);

-- Business verification funnel analysis
CREATE INDEX IF NOT EXISTS "businesses_verification_status_idx" 
ON "businesses"("tin_verified", "bvn_verified", "cac_verified", "status");

-- ============================================
-- Invoice Analytics Indexes
-- ============================================

-- Revenue analytics (total by status and date)
CREATE INDEX IF NOT EXISTS "invoices_status_created_total_idx" 
ON "invoices"("status", "created_at" DESC, "total");

-- Business revenue analytics
CREATE INDEX IF NOT EXISTS "invoices_business_status_total_idx" 
ON "invoices"("business_id", "status", "total") 
WHERE "business_id" IS NOT NULL;

-- Overdue invoice detection and reporting
CREATE INDEX IF NOT EXISTS "invoices_overdue_analytics_idx" 
ON "invoices"("due_date", "status", "total") 
WHERE "status" IN ('sent', 'overdue');

-- Monthly revenue reports
CREATE INDEX IF NOT EXISTS "invoices_monthly_revenue_idx" 
ON "invoices"(DATE_TRUNC('month', "created_at"), "status", "total");

-- ============================================
-- Payment Analytics Indexes
-- ============================================

-- Payment success rate by gateway
CREATE INDEX IF NOT EXISTS "payments_gateway_status_amount_idx" 
ON "payments"("gateway", "status", "amount", "createdAt" DESC);

-- Daily payment volume
CREATE INDEX IF NOT EXISTS "payments_daily_analytics_idx" 
ON "payments"(DATE_TRUNC('day', "createdAt"), "status", "amount");

-- Payment channel analytics
CREATE INDEX IF NOT EXISTS "payments_channel_status_idx" 
ON "payments"("channel", "status", "createdAt" DESC) 
WHERE "channel" IS NOT NULL;

-- ============================================
-- Expense Analytics Indexes
-- ============================================

-- Expense category breakdown by business
CREATE INDEX IF NOT EXISTS "expenses_business_category_amount_idx" 
ON "expenses"("business_id", "category", "amount", "date" DESC);

-- VAT-eligible expense tracking
CREATE INDEX IF NOT EXISTS "expenses_vat_eligible_idx" 
ON "expenses"("business_id", "vat_eligible", "vat_amount", "date" DESC) 
WHERE "vat_eligible" = true;

-- Monthly expense reports
CREATE INDEX IF NOT EXISTS "expenses_monthly_reports_idx" 
ON "expenses"(DATE_TRUNC('month', "date"), "business_id", "category", "amount");

-- ============================================
-- Payroll Analytics Indexes
-- ============================================

-- Payroll processing history
CREATE INDEX IF NOT EXISTS "payrolls_business_period_status_idx" 
ON "payrolls"("business_id", "period" DESC, "status");

-- Total payroll costs by period
CREATE INDEX IF NOT EXISTS "payrolls_period_totals_idx" 
ON "payrolls"("period" DESC, "status", "total_gross", "total_tax");

-- ============================================
-- Tax Remittance Analytics Indexes
-- ============================================

-- Tax remittance tracking by type and period
CREATE INDEX IF NOT EXISTS "tax_remittances_type_period_idx" 
ON "tax_remittances"("business_id", "tax_type", "period" DESC, "status");

-- Overdue tax remittances
CREATE INDEX IF NOT EXISTS "tax_remittances_overdue_idx" 
ON "tax_remittances"("filing_deadline", "status") 
WHERE "status" = 'pending' AND "filing_deadline" < CURRENT_TIMESTAMP;

-- ============================================
-- Compliance Analytics Indexes
-- ============================================

-- Upcoming compliance deadlines
CREATE INDEX IF NOT EXISTS "compliance_reminders_upcoming_idx" 
ON "compliance_reminders"("business_id", "status", "due_date" ASC, "priority") 
WHERE "status" = 'pending';

-- Compliance filing rate
CREATE INDEX IF NOT EXISTS "compliance_reminders_filed_idx" 
ON "compliance_reminders"("tax_type", "status", "filed_at") 
WHERE "status" = 'filed';

-- ============================================
-- Crypto Tax Analytics Indexes
-- ============================================

-- Crypto holdings by asset
CREATE INDEX IF NOT EXISTS "crypto_transactions_asset_type_idx" 
ON "crypto_transactions"("business_id", "asset", "type", "date" DESC);

-- Annual crypto tax calculations
CREATE INDEX IF NOT EXISTS "crypto_transactions_tax_year_idx" 
ON "crypto_transactions"("business_id", "tax_year", "type", "total_ngn");

-- ============================================
-- Device & Sync Performance Indexes
-- ============================================

-- Active device monitoring
CREATE INDEX IF NOT EXISTS "devices_active_last_seen_idx" 
ON "devices"("active", "last_seen_at" DESC) 
WHERE "active" = true;

-- Sync job performance analytics
CREATE INDEX IF NOT EXISTS "sync_jobs_performance_idx" 
ON "sync_jobs"("status", "operation", "created_at" DESC, "completed_at");

-- Failed sync job monitoring
CREATE INDEX IF NOT EXISTS "sync_jobs_failed_retry_idx" 
ON "sync_jobs"("status", "attempts", "created_at" DESC) 
WHERE "status" = 'failed';

-- ============================================
-- Audit & Security Indexes
-- ============================================

-- User activity tracking
CREATE INDEX IF NOT EXISTS "audit_logs_user_action_time_idx" 
ON "audit_logs"("user_id", "action", "created_at" DESC) 
WHERE "user_id" IS NOT NULL;

-- Security event monitoring (last 30 days)
CREATE INDEX IF NOT EXISTS "audit_logs_recent_security_idx" 
ON "audit_logs"("action", "created_at" DESC) 
WHERE "created_at" > CURRENT_TIMESTAMP - INTERVAL '30 days' 
  AND "action" IN ('login_failed', 'password_reset', 'mfa_enabled', 'mfa_disabled');

-- ============================================
-- Alert & Monitoring Indexes
-- ============================================

-- Active alerts by severity
CREATE INDEX IF NOT EXISTS "alerts_active_severity_idx" 
ON "alerts"("resolved", "severity", "timestamp" DESC) 
WHERE "resolved" = false;

-- Alert resolution tracking
CREATE INDEX IF NOT EXISTS "alerts_resolution_time_idx" 
ON "alerts"("type", "resolved", "timestamp", "resolved_at");
