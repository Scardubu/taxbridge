# Customer TIN Migration Guide

## Overview
This migration adds customer TIN and endpoint ID fields to support Peppol BIS Billing 3.0 strict validation requirements.

## Changes Summary

### Database Schema
**Table:** `invoices`
- Added: `customer_tin` (TEXT, nullable)
- Added: `customer_endpoint_id` (TEXT, nullable)

### Backend API
- **POST /api/v1/invoices**: Now accepts `customerTIN` and `customerEndpointId`
- **GET /api/v1/invoices**: Response includes `customerTIN`
- **GET /api/v1/invoices/:id**: Response includes `customerTIN` and `customerEndpointId`

### Mobile App
- Added customer TIN input field in CreateInvoiceScreen (Step 1: Customer Details)
- Updated local SQLite schema to include `customer_tin` and `customer_endpoint_id` columns
- Updated sync service to send customer TIN to backend API

### Admin Dashboard
- Updated invoice detail dialog to display customer TIN
- Updated Invoice TypeScript interface to include customerTIN and customerEndpointId fields

### UBL Generation
- Queue worker now passes customerTIN and customerEndpointId to UBL generator
- UBL generator already supported these fields (customerTIN, customerEndpointId)

## Migration Steps

### 1. Production Database Migration (Render PostgreSQL)

**Option A: Via Render Dashboard**
1. Navigate to Render Dashboard → taxbridge-api → Shell
2. Run:
   ```bash
   echo $DATABASE_URL  # Verify connection
   psql $DATABASE_URL -c "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_tin TEXT;"
   psql $DATABASE_URL -c "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_endpoint_id TEXT;"
   psql $DATABASE_URL -c "\d invoices"  # Verify columns added
   ```

**Option B: Via Prisma (if .env configured)**
```bash
cd backend
yarn prisma migrate dev --name add_customer_tin_fields
```

**Manual SQL (if direct psql access):**
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_tin TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_endpoint_id TEXT;
```

### 2. Mobile App Database Migration

**Automatic on App Launch:**
- Mobile SQLite schema is automatically created/updated in `initDB()` function
- On first app launch after code deployment, new columns will be added
- Existing invoices will have NULL values for customer_tin and customer_endpoint_id
- **No data loss** - all existing invoice data is preserved

**Manual Reset (if issues occur):**
```typescript
// For development/testing only
// In mobile/src/services/database.ts, add migration logic:
if (nativeExec) {
  await nativeExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_tin TEXT;`);
  await nativeExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_endpoint_id TEXT;`);
}
```

### 3. Deployment Sequence

1. **Deploy Backend Changes:**
   - Prisma schema updated
   - API routes accept new fields
   - Queue worker passes fields to UBL generator
   - Deploy to Render: `git push render main`

2. **Run Database Migration:**
   - Execute ALTER TABLE commands (see Option A above)
   - Verify with: `\d invoices`

3. **Deploy Mobile App:**
   - Updated CreateInvoiceScreen with TIN field
   - Updated database.ts with new columns
   - Updated sync.ts to send TIN to API
   - Build and deploy: `eas build --platform all`

4. **Deploy Admin Dashboard:**
   - Updated invoice detail view
   - Deploy to Vercel: `git push origin main` (auto-deploys)

## Validation Impact

### Before Migration (Warnings)
- UBL validation would warn about missing customer TIN
- Invoices could still be submitted (with fallback "N/A" values)
- DigiTax might reject invoices without valid customer identifiers

### After Migration (Strict)
- Customer TIN is optional but recommended
- If provided, must match TIN format: `[A-Z0-9-]{10,20}`
- UBL generator uses customer TIN for:
  - `cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID="TIN"]`
  - `cac:AccountingCustomerParty/cbc:EndpointID[@schemeID="0199"]` (uses customerEndpointId or customerTIN)

## Backward Compatibility

### Existing Invoices
- ✅ All existing invoices remain valid (NULL customer TIN is acceptable)
- ✅ Sync will continue to work for old invoices
- ✅ UBL generation fallback: uses "N/A" if customer TIN is null

### API Compatibility
- ✅ Old mobile app versions can still create invoices (fields are optional)
- ✅ New mobile app can create invoices with or without customer TIN
- ✅ API response includes customerTIN: null for old invoices

## Testing Checklist

- [ ] Database migration successful (columns exist)
- [ ] Backend API accepts customerTIN in POST /api/v1/invoices
- [ ] Backend API returns customerTIN in GET /api/v1/invoices
- [ ] Mobile app displays TIN input field in CreateInvoiceScreen
- [ ] Mobile app saves TIN to local SQLite database
- [ ] Mobile app syncs TIN to backend API
- [ ] Admin dashboard displays customer TIN in invoice detail
- [ ] Queue worker passes customerTIN to UBL generator
- [ ] UBL XML includes customer PartyIdentification with schemeID="TIN"
- [ ] UBL validation passes with customer TIN provided
- [ ] UBL validation passes with customer TIN omitted (fallback to "N/A")

## Rollback Plan

If issues occur:

1. **Database Rollback:**
   ```sql
   ALTER TABLE invoices DROP COLUMN IF EXISTS customer_tin;
   ALTER TABLE invoices DROP COLUMN IF EXISTS customer_endpoint_id;
   ```

2. **Code Rollback:**
   ```bash
   git revert <commit-hash>
   git push render main
   ```

3. **Mobile App Rollback:**
   - Revert mobile app changes
   - Rebuild and redeploy: `eas build --platform all`

## Production Verification

After deployment, verify:

```bash
# Backend API
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"customerName":"Test Corp","customerTIN":"12345678-0001","items":[{"description":"Widget","quantity":1,"unitPrice":100}]}'

# Expected response includes: "invoiceId": "...", "status": "queued"

# Verify database
psql $DATABASE_URL -c "SELECT id, customer_name, customer_tin FROM invoices ORDER BY created_at DESC LIMIT 5;"
```

## Support

For issues or questions:
- Review this migration guide
- Check backend logs: `yarn logs`
- Check mobile app logs: Expo console
- Contact: TaxBridge Engineering Team

---

**Migration Status:** ✅ Code changes complete, database migration pending
**Last Updated:** January 31, 2026
