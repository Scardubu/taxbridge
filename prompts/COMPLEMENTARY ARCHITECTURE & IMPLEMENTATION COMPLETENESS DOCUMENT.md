# V12 COMPLEMENTARY ARCHITECTURE & IMPLEMENTATION COMPLETENESS DOCUMENT

*Gaps identified via exhaustive cross-artifact analysis of APEX-V3, Enhancement Guide V3, Production Architecture V3, and Master Prompt. Ordered by severity.*

---

## COMP-01 · WHT Non-Resident Rate Residual Error — CRITICAL · P
**Location:** Master Prompt MOD-23 (line 763) still contains `"Non-resident → 4% GREEN"`. This is the only artifact among the four that was not corrected during the V3 revision cycle.
**Impact:** Regulatory violation. The erroneous 4% rate surfaces in the production filing wizard and could result in under-remittance and NRS penalties for users.
**Fix:** Non-resident WHT on dividends/interest/royalties = **10%** — identical rate to resident, different remittance channel (`nonResident:true` flag). The 4% rate has no basis in Nigerian tax law (CITA, PITA, or WHT schedules). Eradicate from all paths.
**Canonical constant** in `packages/contracts/src/constants.ts`:
```typescript
export const WHT_RATES = {
  professional:     0.10,  // consultancy/management/technical/dividends/interest/royalties/rent
  construction:     0.05,  // survey/contracts
  nonResident:      0.10,  // same rate — nonResident:true routes to separate NRS remittance channel
} as const;
// NOTE: There is no 0.04 (4%) WHT rate in Nigerian law. Any prior reference is a regulatory error.
```
**Gates (all must exit 0):**
```bash
grep -rn "0\.04\b\|\"4%\"\|'4%'\| 4%" backend/src/routes/v1/filings/wht.ts packages/contracts/src --include="*.ts"  # → 0
grep -rn "nonResident.*0\.10\|WHT_RATES\.nonResident" backend/src/routes/v1/filings/wht.ts  # confirms 10%
npx ts-node -e "const{WHT_RATES}=require('./packages/contracts/src/constants');if(WHT_RATES.nonResident!==0.10)process.exit(1);console.log('✅ WHT non-resident=10%')"
```
**Priority:** M (must fix before Phase 2 gate)

---

## COMP-02 · `computeGaugeMode()` — Undefined Function — CRITICAL · P0

**Location:** Called in `DashboardScreen.tsx` and master prompt but spec'd nowhere in any artifact. Every consumer of `gaugeMode` depends on this function existing at compile time.
**Spec:** Export from `mobile/src/components/dashboard/TaxHealthGauge.tsx` alongside the gauge component:
```typescript
export function computeGaugeMode(data: DashboardStats | undefined): 'expanded' | 'compact' {
  if (!data) return 'expanded';                         // loading/error state → default to expanded
  const deadlines = data.upcomingDeadlines ?? [];       // defensive: field may be absent on partial response
  const hasUrgent = deadlines.some(d => d.daysRemaining <= 7 || d.daysRemaining < 0);
  return hasUrgent ? 'compact' : 'expanded';
  // compact:  120px right-aligned — urgent deadline ≤7d OR overdue (daysRemaining < 0)
  // expanded: 200px centered    — no imminent urgency
}
```
**Usage in `DashboardScreen.tsx`:** `const gaugeMode = useMemo(() => computeGaugeMode(data), [data]);`
**Gates (all must exit 0):**
```bash
grep -q "computeGaugeMode" mobile/src/components/dashboard/TaxHealthGauge.tsx  # defined
grep -q "computeGaugeMode" mobile/src/screens/DashboardScreen.tsx               # consumed
npx ts-node -e "const{computeGaugeMode}=require('./mobile/src/components/dashboard/TaxHealthGauge');if(computeGaugeMode(undefined)!=='expanded')process.exit(1);if(computeGaugeMode({upcomingDeadlines:[{daysRemaining:5}]})!=='compact')process.exit(1);console.log('✅ computeGaugeMode')"
```
**Priority:** M

---

## COMP-03 · `backend/src/routes/v2/analytics.ts` — File Never Specified — HIGH · P1

**Location:** Architecture §4.1 and admin panel reference 5 analytics endpoints; no backend route file ever spec'd.
**Spec:** `backend/src/routes/v2/analytics.ts` [CREATE]
```typescript
// All routes: authenticate + requireRole('ADMIN')
GET /api/v2/analytics/revenue-at-risk    → TaxReturn where status='draft' AND dueDate < now(), grouped by taxType
// NOTE: 'Revenue at Risk' = unfiled past-due returns (penalty exposure), NOT unpaid-but-filed returns.
// This follows Architecture §13. Confirm with product owner if business intent differs before implementing.
GET /api/v2/analytics/compliance-rate    → 6-month window: filed_on_time / total_due per month
GET /api/v2/analytics/risk-distribution  → SMERiskRecord count grouped by band
GET /api/v2/analytics/nrs-health         → nrsCircuitState timeline (last 24h, from metrics + audit events)
GET /api/v2/analytics/dlq-trend          → BullMQ DLQ depth samples, last 7d
```
Mount in `app.ts`: `app.use('/api/v2/analytics', analyticsRouter)`
**Gate:** `test -f backend/src/routes/v2/analytics.ts`
**Priority:** M

---

## COMP-04 · `docker-compose.yml` — Referenced but Never Spec'd — HIGH · P3

**Location:** APEX V3 §Local Dev, Architecture §16 both say `docker compose up -d` with no file spec.
**Spec:** `docker-compose.yml` [CREATE at repo root]
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    ports: ['5432:5432']
    environment:
      POSTGRES_DB: taxbridge_dev
      POSTGRES_USER: taxbridge
      POSTGRES_PASSWORD: dev_password_only
    volumes: ['pg_data:/var/lib/postgresql/data']
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    command: redis-server --appendonly yes
    volumes: ['redis_data:/data']
volumes:
  pg_data:
  redis_data:
```
`.env.example` must contain:
```bash
DATABASE_URL="postgresql://taxbridge:dev_password_only@localhost:5432/taxbridge_dev?sslmode=disable"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-secret-minimum-32-characters-replace-in-prod"
JWT_REFRESH_SECRET="dev-refresh-secret-minimum-64-characters-replace-in-production-env"
NODE_ENV=development
PORT=10000
DIGITAX_MOCK_MODE=true
EXPO_PUBLIC_API_URL=http://localhost:10000
LOG_LEVEL=debug
```
**Gate:** `test -f docker-compose.yml && test -f .env.example`
**Priority:** M

---

## COMP-05 · `backend/src/services/eventBus.ts` — Only One Line Ever Spec'd — HIGH · P2

**Location:** All artifacts show only: `eventBus.on('filing.submitted', ...)`. Full setup contract undefined.
**Spec:** `backend/src/services/eventBus.ts` [CREATE]
```typescript
import { EventEmitter } from 'events';
import { Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis';  // shared ioredis singleton — see COMP-19
import { logger } from './logger';    // Pino logger — C-26

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

export const pdfQueue = new Queue('pdf-generation', {
  connection: redis,
  defaultJobOptions: { attempts:3, backoff:{ type:'exponential', delay:5000 }, removeOnComplete:100, removeOnFail:200 },
});

// Wire: filing.submitted → PDF receipt async (C-40)
eventBus.on('filing.submitted', (payload: { filingId:string; orgId:string }) =>
  pdfQueue.add('generate-receipt', payload, { priority:2 })
    .catch(e => { Sentry.captureException(e); logger.error({err:e},'pdfQueue.add failed'); })
);
```
**Gate:** `grep -q "setMaxListeners" backend/src/services/eventBus.ts`
**Note:** `backend/src/lib/redis.ts` singleton is a prerequisite — see COMP-19.
**Priority:** M

---

---

## COMP-19 · `backend/src/lib/redis.ts` — IORedis Singleton Never Spec'd — HIGH · P0

**Location:** `eventBus.ts` (COMP-05), `idempotency.ts` (C-35), `require2FA.ts`, and `nrsService.ts` all import `redis` from `'../lib/redis'` but this singleton is spec'd nowhere — parallel to the `prisma.ts` gap that was closed as C-43.
**Spec:** `backend/src/lib/redis.ts` [CREATE]
```typescript
import IORedis from 'ioredis';
import { logger } from './logger';

const createClient = (): IORedis => {
  const client = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,  // required for BullMQ
    enableReadyCheck: false,     // prevents startup errors on Render Redis
    lazyConnect: false,
  });
  client.on('error', err => logger.error({ err }, 'Redis connection error'));
  return client;
};

declare global { var __taxbridge_redis: IORedis | undefined; }
export const redis: IORedis =
  process.env.NODE_ENV === 'production'
    ? createClient()
    : (global.__taxbridge_redis ??= createClient());
```
`REDIS_URL` in production: `rediss://` (TLS). In `.env.example`: `redis://localhost:6379` (plain).
**Gate:** `grep -q "global.__taxbridge_redis" backend/src/lib/redis.ts`
**Priority:** M

---

## COMP-06 · `scripts/backfill-v12.ts` — Referenced but Zero Spec — HIGH · P3

**Location:** Migration sequence in all 3 artifacts: `yarn workspace backend ts-node scripts/backfill-v12.ts`. Content never defined.
**Spec:** `scripts/backfill-v12.ts` [CREATE]
```typescript
// Backfill operations (run once between migrations — idempotent):
// 1. For every existing TaxReturn with receiptUrl=null and status='filed':
//    emit 'filing.submitted' to trigger PDF receipt generation
// 2. For every existing OrgMember without UserDevice record: no-op (devices registered on next login)
// 3. Set TaxHealthSnapshot.band for any rows where band is null (legacy):
//    band = score>=80?'healthy':score>=60?'low':score>=40?'medium':score>=20?'high':'critical'
// 4. Validate all existing TaxReturn.filingReference match TB-{YEAR}-{TAXTYPE}-{NANOID(8)} pattern;
//    log warnings for non-conforming records (do not mutate — alert for manual review)
async function main() {
  logger.info('Starting v12 backfill...');
  // Step 1: PDF receipts (C-01: always use (prisma as any))
  const unfiled = await (prisma as any).taxReturn.findMany({ where:{ receiptUrl:null, status:'filed' } });
  logger.info({ count:unfiled.length }, 'Queuing PDF receipts for filed returns');
  for (const r of unfiled) eventBus.emit('filing.submitted', { filingId:r.id, orgId:r.orgId });
  // Step 3: Band backfill — TaxHealthSnapshot is INSERT-ONLY (immutability contract, no updatedAt).
  // NEVER use prisma.update here. Use raw SQL for this one-time migration only.
  await (prisma as any).$executeRaw`
    UPDATE "TaxHealthSnapshot" SET band = CASE
      WHEN score >= 80 THEN 'healthy'::text WHEN score >= 60 THEN 'low'::text
      WHEN score >= 40 THEN 'medium'::text  WHEN score >= 20 THEN 'high'::text
      ELSE 'critical'::text END
    WHERE band IS NULL`;
  // Step 4: Audit filingReference format — log warnings, never mutate
  const badRef = await (prisma as any).taxReturn.findMany({
    where:{ NOT:{ filingReference:{ startsWith:'TB-' } } }, select:{ id:true, filingReference:true }
  });
  if (badRef.length) logger.warn({ count:badRef.length, sample:badRef.slice(0,3) }, 'Non-conforming filingReference — manual review required');
  logger.info('v12 backfill complete');
  await (prisma as any).$disconnect();
}
main().catch(e => { logger.error(e); process.exit(1); });
```
**Gate:** `test -f scripts/backfill-v12.ts`
**Priority:** M

---

## COMP-07 · `taxbridge_v12_emergency_rollback()` Stored Procedure — Never Defined — HIGH · P3

**Location:** All rollback sections reference `CALL taxbridge_v12_emergency_rollback()` — procedure body never defined.
**Spec:** `scripts/create-emergency-rollback-proc.sql` [CREATE — run once pre-deploy]
```sql
CREATE OR REPLACE PROCEDURE taxbridge_v12_emergency_rollback()
LANGUAGE plpgsql AS $$
BEGIN
  -- SCOPE: Only used when code rollback is insufficient and DB state must be reverted.
  -- DOES NOT roll back migrations (never use prisma migrate rollback).
  -- REVERTS application-layer data written by V12 only:
  --   1. Soft-delete all UserDevice records created after V12 deploy timestamp
  UPDATE "UserDevice" SET active = false
    WHERE "createdAt" > (SELECT value::timestamptz FROM "_V12DeployMarker" WHERE key = 'v12_deploy_at');
  --   2. Null-out receiptUrl for TaxReturn records generated by pdfWorker post-V12
  UPDATE "TaxReturn" SET "receiptUrl" = NULL
    WHERE "updatedAt" > (SELECT value::timestamptz FROM "_V12DeployMarker" WHERE key = 'v12_deploy_at')
    AND "receiptUrl" IS NOT NULL;
  --   3. Log the rollback event
  INSERT INTO "AuditEvent" ("id","orgId","actorId","actorRole","targetType","targetId","action","createdAt")
    VALUES (gen_random_uuid(),'SYSTEM','SYSTEM','SYSTEM','Database','ALL','OVERRIDE',now());
  RAISE NOTICE 'V12 emergency rollback complete. Review data integrity before resuming traffic.';
END;
$$;
-- Pre-create: record V12 deploy timestamp.
-- NOTE: "SystemConfig" is NOT in the Prisma schema. Use a raw migration-marker table instead.
CREATE TABLE IF NOT EXISTS "_V12DeployMarker" (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO "_V12DeployMarker" (key, value) VALUES ('v12_deploy_at', now()::text)
  ON CONFLICT (key) DO NOTHING;
```
**Gate:** `test -f scripts/create-emergency-rollback-proc.sql`
**Priority:** S (should — required pre-deploy)

---

## COMP-08 · `resolveOrgContext` Dual Check — C-12 Enforcement Gap — HIGH · P0

**Location:** Architecture §3.1 specifies `OrgMember status:'active' AND deletedAt:null` in `tenant.ts`. C-12 specifies `Organisation.status` checked on every request. No artifact joins both checks in a single spec.
**Spec:** `backend/src/middleware/tenant.ts` must enforce BOTH:
```typescript
export async function resolveOrgContext(req: Request, res: Response, next: NextFunction) {
  const membership = await (prisma as any).orgMember.findFirst({
    where: { userId:req.user.id, orgId:req.params.orgId ?? req.body.orgId,
             status:'active', deletedAt:null },
    include: { org: true },
  });
  if (!membership) return res.status(403).json({ error:'NOT_A_MEMBER' });
  if (membership.org.status === 'suspended')
    return res.status(403).json({ error:'ORG_SUSPENDED' });  // C-12
  if (membership.org.status === 'pending_verification')
    return res.status(403).json({ error:'ORG_PENDING_VERIFICATION' });
  req.orgContext = { orgId:membership.orgId, role:membership.role, org:membership.org };
  next();
}
```
**Gate:** `grep -q "ORG_SUSPENDED" backend/src/middleware/tenant.ts`
**Priority:** M

---

## COMP-09 · `prompts:verify` — 11 Modules Never Listed — MEDIUM · P0

**Location:** Every pre-execution gate requires `yarn prompts:verify → "✅ 12/12 modules"`. The 11 modules and the verifier script are never defined.
**Spec:** `scripts/verify-prompts.ts` [CREATE] — add to `package.json` scripts as `"prompts:verify"`
```typescript
import fs from 'fs';
import path from 'path';

// The 12 required modules (updated from 11 after COMP-19 added redis.ts):
const REQUIRED_MODULES = [
  'prompts/v12_master_prompt.md',
  'prompts/v12_production_architecture_module.md',
  'packages/contracts/src/cit.ts',
  'packages/contracts/src/types.ts',
  'backend/src/validateEnv.ts',
  'backend/src/lib/prisma.ts',
  'backend/src/routes/v1/auth/totp.ts',
  'backend/src/routes/v1/notifications.ts',
  'backend/src/workers/pdfWorker.ts',
  'mobile/src/hooks/useDeepLink.ts',
  'mobile/src/components/shared/ConfettiAnimation.tsx',
  'backend/src/lib/redis.ts',
];
const missing = REQUIRED_MODULES.filter(m => !fs.existsSync(path.resolve(m)));
if (missing.length) { console.error(`❌ Missing: ${missing.join(', ')}`); process.exit(1); }
console.log('✅ 12/12 modules');
```
**Gate:** `yarn prompts:verify` → exits 0
**Priority:** M

---

## COMP-10 · `backend/src/lib/logger.ts` — C-45 Redaction Incomplete — MEDIUM · P0

**Location:** All artifacts specify Pino redaction. APEX V3 adds `receiptUrl` and `documentUrl` (C-45) but the logger.ts spec in the main body only lists 6 fields.
**Complete redaction array (authoritative):**
```typescript
redact: {
  paths: [
    'req.headers.authorization',
    'body.password',
    'body.tin',
    'body.bvn',
    'body.bankAccount',
    'body.cardNumber',
    'body.receiptUrl',      // C-21, C-45
    'body.documentUrl',     // C-21, C-45
    '*.receiptUrl',
    '*.documentUrl',
  ],
  censor: '[REDACTED]',
}
```
**Gate:** `grep -q "receiptUrl" backend/src/lib/logger.ts`
**Priority:** M

---

## COMP-11 · `decodeCursor` Safety — Master Prompt Retains Unsafe Version — MEDIUM · P0

**Location:** Master prompt P0.5 lines 189–192: `JSON.parse(Buffer.from(cursor,...))` has no try/catch.
**Authoritative spec (APEX V3 corrected version — canonical):**
```typescript
export const decodeCursor = (c: string): { createdAt:Date; id:string } => {
  try {
    const { createdAt, id } = JSON.parse(Buffer.from(c,'base64').toString('utf8'));
    if (!createdAt || !id) throw new Error('invalid cursor shape');
    return { createdAt:new Date(createdAt), id };
  } catch {
    throw Object.assign(new Error('INVALID_CURSOR'), { status:400 });
  }
};
```
**Gate:** Completion criterion 33 (`decodeCursor` has try/catch with 400 status)
**Priority:** M

---

## COMP-12 · `formatNGN` K Suffix — Master Prompt Retains `toFixed(0)` — MEDIUM · P0

**Location:** Master prompt line 76: `.toFixed(0)K` — produces `₦1K` instead of `₦1.5K`.
**Authoritative spec:** `if(amount>=1e3)return \`₦${(amount/1e3).toFixed(1)}K\``
**Gate:** `formatNGN(1_500,{compact:true})==='₦1.5K'` (completion criterion 31)
**Priority:** M

---

## COMP-13 · Admin `next.config.js` CSP Header — Absent from Master Prompt — MEDIUM · P1

**Location:** APEX V3 P1.B has full CSP configuration. Master prompt P3.4 only has compress/poweredByHeader/images.
**Complete authoritative spec:**
```javascript
module.exports = {
  compress:true, poweredByHeader:false,
  experimental:{ optimizeCss:true }, images:{ formats:['image/avif','image/webp'] },
  async headers() {
    return [{ source:'/(.*)', headers:[{
      key:'Content-Security-Policy',
      value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.taxbridge.ng https://*.r2.cloudflarestorage.com"
    }]}];
  },
};
```
**Gate:** `grep -q "Content-Security-Policy" admin/next.config.js`
**Priority:** S

---

## COMP-14 · `useDashboard` Stale-on-Resume Check — Missing from Master Prompt — MEDIUM · P0

**Location:** APEX V3 spec includes AppState `'active'` → 120s staleness check before invalidation. Master prompt omits it.
**Spec:** `mobile/src/hooks/useDashboard.ts` must include:
```typescript
const lastFetchTimeRef = useRef<number>(0);
useEffect(() => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active' && Date.now() - lastFetchTimeRef.current > 120_000)
      queryClient.invalidateQueries({ queryKey:['dashboard', orgId, userId] });
  });
  return () => sub.remove();
}, [orgId, userId]);
// Update lastFetchTimeRef.current = Date.now() on each successful fetch
```
**Gate:** `grep -q "lastFetchTime\|lastFetchTimeRef" mobile/src/hooks/useDashboard.ts`
**Priority:** S

---

## COMP-15 · Auth_Failure_Flood Dual Threshold — Architecture Clarification Missing from Master Prompt — MEDIUM · P1

**Location:** Architecture V3 §7.1 clarifies two complementary thresholds. Master prompt anomalyEngine only shows one.
**Authoritative spec:**
- `anomalyEngine.ts`: `auth_failure_flood` signal fires when `>10 failures/1h/IP` — long-window pattern detection
- `infra/grafana/alerts.yml` `Auth_Flood` alert fires when `rate(...[1m]) > 10` — real-time spike alert
- **Both are required and complementary. Do NOT consolidate. Do NOT change either threshold.**
**Gate:** Comment in `anomalyEngine.ts`: `// auth_failure_flood: >10/1h/IP → long-window; Grafana fires >10/1min → spike`
**Priority:** S

---

---

*— Items below this line are LOW priority (Could Have) —*

---

## COMP-16 · VIEWER_TOKEN Missing from Master Prompt GitHub Secrets — LOW · P3

**Location:** APEX V3 env manifest lists `VIEWER_TOKEN` in GITHUB SECRETS (used in smoke test #6 RBAC check). Master prompt omits it.
**Add to env manifest GitHub Secrets section:** `VIEWER_TOKEN  # low-privilege token for RBAC smoke test`
**Priority:** C

---

## COMP-17 · TOTP Lockout Recovery Runbook — Missing from Master Prompt — LOW · P0

**Location:** Enhancement Guide Risk Register has recovery path. Master prompt has none.
**Spec:** Add to runbook/README:
```
TOTP LOCKOUT RECOVERY:
(1) Primary: Peer SUPER_ADMIN calls POST /api/v1/auth/totp/disable with their own 2FA confirmation
(2) Fallback (no peer): ⚠️ EXECUTE ONLY DURING MAINTENANCE WINDOW with active connections drained.
    A concurrent login attempt during this window can bypass the lockout — drain connections first.
    DBA runs: UPDATE "User" SET "totpEnabled"=false, "totpSecret"=NULL WHERE id='<userId>';
    Write AuditEvent manually: INSERT INTO "AuditEvent" (id,"orgId","actorId","actorRole","targetType","targetId",action,after,"createdAt")
      VALUES (gen_random_uuid(),'SYSTEM','DBA','SYSTEM','User','<userId>','OVERRIDE','{"reason":"emergency_totp_disable"}',now());
(3) Backup codes: POST /api/v1/auth/totp/backup with bcrypt.compare — one-time, immutable once redeemed
```
**Priority:** C

---

## COMP-18 · `scripts/seed-dev.ts` Missing from Repo Structure in Master Prompt — LOW · P3

**Location:** Architecture §16 and APEX V3 define seed-dev.ts spec; master prompt repo structure tree does not list it.
**Canonical path:** `scripts/seed-dev.ts` — must appear in `scripts/` directory in repo structure documentation.
**Priority:** C

---

*End of Complementary Document — 19 gaps closed (COMP-01–19). Priorities: 10 Must · 5 Should · 4 Could*

