# 🔄 TaxBridge Backup & Recovery Procedures

**Version:** 1.0.0  
**Last Updated:** February 10, 2026  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Database Backups](#database-backups)
4. [File Storage Backups](#file-storage-backups)
5. [Redis Backups](#redis-backups)
6. [Recovery Procedures](#recovery-procedures)
7. [Disaster Recovery](#disaster-recovery)
8. [Testing & Validation](#testing--validation)

---

## 🎯 Overview

### Backup Objectives

- **RPO (Recovery Point Objective):** ≤ 1 hour
- **RTO (Recovery Time Objective):** ≤ 4 hours
- **Data Retention:** 30 days (daily), 12 months (monthly)
- **Compliance:** 7-year retention for tax records

### Critical Data Assets

1. **PostgreSQL Database** (Primary)
   - User accounts and authentication
   - Business registrations
   - Invoices and payments
   - Tax calculations and remittances
   - Payroll records
   - Compliance data

2. **Redis Cache/Queue** (Secondary)
   - Session data
   - Job queues (BullMQ)
   - Rate limiting data
   - Temporary cache

3. **File Storage** (Tertiary)
   - Invoice PDFs
   - Receipt images (OCR)
   - UBL XML files
   - Generated reports

---

## 📊 Backup Strategy

### Automated Backups

| Asset | Frequency | Retention | Method | Location |
|-------|-----------|-----------|--------|----------|
| PostgreSQL | Hourly | 24 hours | Continuous (WAL) | Supabase |
| PostgreSQL | Daily | 30 days | Full dump | Supabase + S3 |
| PostgreSQL | Weekly | 12 months | Full dump | S3 Glacier |
| Redis | Daily | 7 days | RDB snapshot | Render |
| Files (PDFs) | Daily | 90 days | Incremental | S3 |
| Files (Receipts) | Daily | 7 years | Incremental | S3 Glacier |

### Backup Windows

- **Database:** Continuous (Point-in-Time Recovery enabled)
- **Files:** 02:00 - 04:00 UTC (low traffic period)
- **Redis:** 03:00 UTC daily

---

## 💾 Database Backups

### Supabase PostgreSQL Backups

**Automatic Backups (Managed by Supabase):**

```bash
# Supabase provides:
# - Continuous WAL archiving (Point-in-Time Recovery)
# - Daily automated backups (retained for 30 days)
# - Instant restore to any point in the last 7 days
```

**Manual Backup (On-Demand):**

```bash
# 1. Using pg_dump (recommended for exports)
pg_dump \
  "postgresql://postgres:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require" \
  --format=custom \
  --file=taxbridge_backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Compress backup
gzip taxbridge_backup_*.dump

# 3. Upload to S3
aws s3 cp taxbridge_backup_*.dump.gz \
  s3://taxbridge-backups/database/$(date +%Y/%m/%d)/
```

**Backup Verification:**

```bash
# List backup contents
pg_restore --list taxbridge_backup_*.dump

# Test restore to temporary database
createdb taxbridge_test_restore
pg_restore \
  --dbname=taxbridge_test_restore \
  --verbose \
  taxbridge_backup_*.dump

# Verify data
psql taxbridge_test_restore -c "SELECT COUNT(*) FROM \"Business\";"
psql taxbridge_test_restore -c "SELECT COUNT(*) FROM \"Invoice\";"

# Cleanup
dropdb taxbridge_test_restore
```

### Backup Script (Automated)

Create `backend/scripts/backup-database.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/taxbridge"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="taxbridge_${TIMESTAMP}.dump"
S3_BUCKET="s3://taxbridge-backups/database"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
echo "Starting database backup..."
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="${BACKUP_DIR}/${BACKUP_FILE}"

# Compress
echo "Compressing backup..."
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" \
  "${S3_BUCKET}/$(date +%Y/%m/%d)/${BACKUP_FILE}.gz"

# Cleanup local backups older than 7 days
find $BACKUP_DIR -name "*.dump.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

**Schedule with Cron:**

```bash
# Add to crontab
0 2 * * * /path/to/backend/scripts/backup-database.sh >> /var/log/taxbridge-backup.log 2>&1
```

---

## 📁 File Storage Backups

### S3 Bucket Structure

```
taxbridge-storage/
├── invoices/
│   ├── pdfs/
│   │   └── 2026/
│   │       ├── 01/
│   │       ├── 02/
│   │       └── ...
│   └── ubl/
├── receipts/
│   └── 2026/
└── reports/
```

### Backup Configuration

**S3 Lifecycle Policies:**

```json
{
  "Rules": [
    {
      "Id": "InvoicePDFRetention",
      "Status": "Enabled",
      "Prefix": "invoices/pdfs/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    },
    {
      "Id": "ReceiptRetention",
      "Status": "Enabled",
      "Prefix": "receipts/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
```

**Versioning:**

```bash
# Enable versioning on S3 bucket
aws s3api put-bucket-versioning \
  --bucket taxbridge-storage \
  --versioning-configuration Status=Enabled

# Enable MFA delete protection
aws s3api put-bucket-versioning \
  --bucket taxbridge-storage \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::ACCOUNT:mfa/root-account-mfa-device XXXXXX"
```

---

## 🔴 Redis Backups

### Render Redis Backups

**Automatic Backups (Managed by Render):**

- Daily RDB snapshots
- 7-day retention
- Automatic restore available

**Manual Backup:**

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Trigger manual save
BGSAVE

# Check save status
LASTSAVE

# Download RDB file (if accessible)
# Note: Render manages this automatically
```

**Important:** Redis data is **non-critical** for TaxBridge:
- Session data: Can be regenerated (users re-login)
- Job queues: Jobs are persisted in database
- Cache: Can be rebuilt from database

---

## 🔄 Recovery Procedures

### Database Recovery

#### Scenario 1: Restore to Specific Point in Time

```bash
# 1. Using Supabase Dashboard
# - Navigate to Database → Backups
# - Select "Point-in-Time Recovery"
# - Choose timestamp
# - Click "Restore"

# 2. Using Supabase CLI
supabase db restore \
  --project-ref lkgcfixhrvllmieriwml \
  --timestamp "2026-02-10T10:30:00Z"
```

#### Scenario 2: Restore from Manual Backup

```bash
# 1. Download backup from S3
aws s3 cp \
  s3://taxbridge-backups/database/2026/02/10/taxbridge_20260210_020000.dump.gz \
  ./

# 2. Decompress
gunzip taxbridge_20260210_020000.dump.gz

# 3. Restore to database
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --verbose \
  taxbridge_20260210_020000.dump

# 4. Verify restoration
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"Business\";"
psql "$DATABASE_URL" -c "SELECT MAX(\"createdAt\") FROM \"Invoice\";"
```

#### Scenario 3: Partial Data Recovery

```bash
# Restore specific tables only
pg_restore \
  --dbname="$DATABASE_URL" \
  --table="Invoice" \
  --table="Payment" \
  --verbose \
  taxbridge_backup.dump

# Or restore specific schema
pg_restore \
  --dbname="$DATABASE_URL" \
  --schema=public \
  --verbose \
  taxbridge_backup.dump
```

### File Storage Recovery

```bash
# 1. List available backups
aws s3 ls s3://taxbridge-backups/files/2026/02/10/

# 2. Restore specific files
aws s3 sync \
  s3://taxbridge-backups/files/2026/02/10/ \
  /var/taxbridge/restored-files/

# 3. Restore to production bucket
aws s3 sync \
  /var/taxbridge/restored-files/ \
  s3://taxbridge-storage/
```

### Application Recovery

```bash
# 1. Stop application
pm2 stop taxbridge-backend

# 2. Restore database (see above)

# 3. Clear Redis cache
redis-cli -u $REDIS_URL FLUSHALL

# 4. Regenerate Prisma client
cd backend
npx prisma generate

# 5. Run migrations (if needed)
npx prisma migrate deploy

# 6. Restart application
pm2 start taxbridge-backend

# 7. Verify health
curl http://localhost:3000/health
```

---

## 🚨 Disaster Recovery

### Complete System Failure

**Recovery Steps:**

1. **Assess Damage**
   ```bash
   # Check what's available
   - Database: Check Supabase status
   - Files: Check S3 bucket
   - Application: Check Render deployment
   ```

2. **Provision New Infrastructure**
   ```bash
   # If using Render (automated)
   - Deploy from GitHub (automatic rebuild)
   - Database: Restore from Supabase backup
   - Redis: Provision new instance (data non-critical)
   ```

3. **Restore Data**
   ```bash
   # Database
   supabase db restore --timestamp "LATEST"
   
   # Files (if S3 intact, no action needed)
   # S3 has 99.999999999% durability
   ```

4. **Verify and Test**
   ```bash
   # Run validation script
   node backend/scripts/production-validation.js post-deploy https://api.taxbridge.ng
   
   # Test critical flows
   - User login
   - Invoice creation
   - Payment processing
   - Tax calculations
   ```

5. **Update DNS (if needed)**
   ```bash
   # Point to new infrastructure
   # Update A/CNAME records
   ```

### Data Corruption Recovery

```bash
# 1. Identify corruption scope
psql "$DATABASE_URL" -c "SELECT * FROM \"Invoice\" WHERE \"total\" < 0;"

# 2. Restore from last known good backup
# Use point-in-time recovery to before corruption

# 3. Re-run affected transactions
# Replay from audit logs if available
```

---

## ✅ Testing & Validation

### Monthly Backup Test

```bash
#!/bin/bash
# Test backup restoration monthly

# 1. Download latest backup
LATEST_BACKUP=$(aws s3 ls s3://taxbridge-backups/database/ --recursive | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://taxbridge-backups/${LATEST_BACKUP}" ./test_backup.dump.gz

# 2. Create test database
createdb taxbridge_backup_test

# 3. Restore
gunzip test_backup.dump.gz
pg_restore --dbname=taxbridge_backup_test test_backup.dump

# 4. Validate
psql taxbridge_backup_test -c "SELECT COUNT(*) FROM \"Business\";"
psql taxbridge_backup_test -c "SELECT COUNT(*) FROM \"Invoice\";"
psql taxbridge_backup_test -c "SELECT COUNT(*) FROM \"Payment\";"

# 5. Cleanup
dropdb taxbridge_backup_test
rm test_backup.dump

echo "Backup test completed successfully"
```

### Backup Validation Checklist

- [ ] Database backup exists and is recent (< 24 hours)
- [ ] Backup file size is reasonable (not 0 bytes)
- [ ] Backup can be decompressed successfully
- [ ] pg_restore --list shows expected tables
- [ ] Test restore completes without errors
- [ ] Restored data matches expected counts
- [ ] S3 backups are accessible
- [ ] Backup retention policies are active
- [ ] Monitoring alerts are configured

---

## 📞 Emergency Contacts

**Backup Issues:**
- Database: Supabase Support (support@supabase.com)
- Storage: AWS Support
- Application: Render Support

**Internal:**
- DevOps Lead: devops@taxbridge.ng
- CTO: cto@taxbridge.ng
- On-call: +234-XXX-XXXX-XXX

---

## 📝 Backup Logs

### Location

- Database backups: `/var/log/taxbridge-backup.log`
- S3 sync logs: CloudWatch Logs
- Supabase backups: Supabase Dashboard → Backups

### Monitoring

```bash
# Check last backup time
aws s3 ls s3://taxbridge-backups/database/ --recursive | tail -n 5

# Check backup sizes
aws s3 ls s3://taxbridge-backups/database/$(date +%Y/%m/%d)/ --human-readable

# Monitor backup failures
grep "ERROR" /var/log/taxbridge-backup.log
```

---

## 🔐 Security

### Backup Encryption

- **Database:** Encrypted at rest (Supabase default)
- **S3:** Server-side encryption (SSE-S3)
- **Transit:** TLS 1.3 for all transfers

### Access Control

```bash
# S3 bucket policy (restrict access)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/TaxBridgeBackupRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::taxbridge-backups/*"
    }
  ]
}
```

---

**Last Reviewed:** February 10, 2026  
**Next Review:** May 10, 2026  
**Owner:** DevOps Team
