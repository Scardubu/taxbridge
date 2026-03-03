# TaxBridge V12 — Enhancement Guide
**Version:** V12-REFINED-2 | **Date:** 2026-03-03 | **Branch:** `upgrade/v12-elevated-20260302`
**Authority:** Companion to V12 APEX Execution Directive. Enforces GAP-01–GAP-15. Resolves all missing implementation components for full operational readiness.

---

# PART I: GAP SUMMARY

| ID | Category | Risk | Phase |
|---|---|---|---|
| GAP-01 | Push notification infrastructure — end-to-end absent | CRITICAL | P0 |
| GAP-02 | Refresh token reuse — security response incomplete | CRITICAL | P0 |
| GAP-03 | TOTP enrollment — completely absent | CRITICAL | P0 |
| GAP-04 | Pagination — no universal cursor contract | HIGH | P0 |
| GAP-05 | CIT module (MOD-28) — entirely missing | CRITICAL | P2 |
| GAP-06 | Flutterwave webhook — no idempotency guard | CRITICAL | P2 |
| GAP-07 | Deep linking — no Expo Router config or route allowlist | HIGH | P1 |
| GAP-08 | WCAG 2.2 AA — filing wizards unspecified | HIGH | P1 |
| GAP-09 | Rate limit headers — not exposed to clients | HIGH | P1 |
| GAP-10 | PgBouncer connection pooling — not configured | HIGH | P0 |
| GAP-11 | 2G network resilience — no exponential backoff or offline-first | HIGH | P1 |
| GAP-12 | Admin panel — no CSRF protection or role_version sync | CRITICAL | P1 |
| GAP-13 | VAT registration guard — unregistered orgs can file | CRITICAL | P2 |
| GAP-14 | Lottie animations — no asset strategy, no error fallback | MEDIUM | P0 |
| GAP-15 | PDF receipt generation — no implementation | HIGH | P2 |

---

# PART II: GAP RESOLUTIONS

## GAP-01: Push Notification Infrastructure

**Problem:** `notifications.ts` is listed in the master prompt but its implementation contract is undefined. Compliance reminder cron fires at 09:00 WAT but silently no-ops: no token registration flow, payload schema, delivery fallback chain, or Expo credential management exists.

**`mobile/src/hooks/usePushNotification.ts`** — call in App root on mount:
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing !== 'granted' ? await Notifications.requestPermissionsAsync() : { status: existing };
  if (status !== 'granted') return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: process.env.EXPO_PUBLIC_PROJECT_ID })).data;
  await apiClient.post('/api/v1/notifications/register', { token, platform: Platform.OS });
  return token;
}
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert:true, shouldPlaySound:true, shouldSetBadge:true }),
});
```

**`backend/src/routes/v1/notifications.ts`**:
```typescript
// POST /api/v1/notifications/register  — { token, platform:'ios'|'android' } → upsert UserDevice(unique userId+token)
// POST /api/v1/notifications/unregister — set active=false (soft delete)
```

**`backend/src/services/notifications.ts`**:
```typescript
// NotificationPayload: { title(≤80ch bilingual), body(≤150ch — Expo hard limit C-39),
//   data: { route, orgId, type:'compliance'|'anomaly'|'payment'|'system' } }
async function sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
  const devices = await (prisma as any).userDevice.findMany({ where: { userId, active: true } });
  if (!devices.length) { await sendSMSFallback(userId, payload.body); return; }
  for (const chunk of chunkArray(
    devices.map(d => ({ to:d.pushToken, sound:'default', ...payload,
      channelId: payload.data.type === 'compliance' ? 'compliance' : 'general' })), 100
  )) await expo.sendPushNotificationsAsync(chunk);
}
async function sendSMSFallback(userId: string, body: string): Promise<void> {
  // Africa's Talking SMS — fires when no active push devices on record
}
```

**`backend/prisma/schema.prisma`** — add model:
```prisma
model UserDevice {
  id         String   @id @default(cuid())
  userId     String
  pushToken  String
  platform   String
  active     Boolean  @default(true)
  lastSeenAt DateTime @default(now())
  createdAt  DateTime @default(now())
  @@unique([userId, pushToken])
  @@index([userId, active])
}
```
Add `SECURITY_ALERT` to `AuditAction` enum (required by GAP-02).

EAS secrets (CLI only — never in `eas.json`):
```bash
eas secret:create --scope project --name EXPO_PUSH_ACCESS_TOKEN --value <token>
eas secret:create --scope project --name EXPO_PUBLIC_PROJECT_ID  --value <id>
```

---

## GAP-02: Refresh Token Reuse — Incomplete Security Response

**Problem:** Session invalidation on token reuse is specified, but no push notification, audit event, or Sentry alert is triggered. A credential stuffing attack is invisible until the legitimate user next attempts login.

**`backend/src/routes/v1/auth.ts`** — add `handleSuspiciousReuse()`:
```typescript
async function handleSuspiciousReuse(userId: string, ip: string): Promise<void> {
  await (prisma as any).userSession.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
  await redis.del(`role_version:${userId}`);
  await writeAuditEvent({
    orgId:'SYSTEM', actorId:userId, actorRole:'SYSTEM', targetType:'UserSession', targetId:userId,
    action:'SECURITY_ALERT', after:{ reason:'refresh_token_reuse', ip }, ip,
  }, prisma);
  await sendPushNotification(userId, {
    title: 'Security Alert',
    body: 'Unusual login activity detected. All sessions have been signed out.',
    data: { route:'/profile/security', orgId:'', type:'system' },
  });
  Sentry.captureMessage('Refresh token reuse detected', { level:'warning', extra:{ userId, ip } });
}
```

---

## GAP-03: TOTP Enrollment — Completely Absent

**Problem:** `require2FA` middleware verifies `redis.get('totp:${userId}')` but no enrollment screen, QR generation endpoint, backup code system, or verification endpoint exists. SUPER_ADMIN cannot enroll TOTP.

**`backend/src/routes/v1/auth/totp.ts`**:
```typescript
// POST /api/v1/auth/totp/setup   — authenticate + requireRole('SUPER_ADMIN')
//   Returns: { qrCodeDataUrl, secret, backupCodes: string[10] }
//   Stores:  AES-256-GCM encrypted secret; backup codes bcrypt-hashed (C-38)

// POST /api/v1/auth/totp/verify  — authenticate
//   Body: { token: string } — 6-digit TOTP
//   Success: redis.setex(`totp:${userId}`, 300, '1')
//   5 consecutive failures: lock account + emit SECURITY_ALERT AuditEvent

// POST /api/v1/auth/totp/disable — authenticate + requireRole('SUPER_ADMIN') + require2FA
//   Requires current TOTP + password confirmation. Emits AuditEvent:'UPDATE'

// POST /api/v1/auth/totp/backup  — authenticate
//   bcrypt.compare against stored hashes; mark code used — one-time, immutable once redeemed
```

**`mobile/src/screens/auth/TOTPSetupScreen.tsx`**:
```
Step 1: Display QR code + manual secret entry string (always both)
Step 2: User scans with authenticator app
Step 3: Verify 6-digit token to confirm enrollment
Step 4: Display 10 backup codes — require explicit "I've saved these" confirmation gate
Step 5: Redirect to dashboard
```

---

## GAP-04: Pagination — No Universal Contract

**Problem:** Cursor-based pagination is referenced for audit logs but encoding, shape, and admin frontend integration are undefined. Each endpoint implements pagination differently.

**`packages/contracts/src/types.ts`** — add:
```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor:      string | null;  // base64({createdAt, id})
    prevCursor:      string | null;
    hasNextPage:     boolean;
    hasPreviousPage: boolean;
    total:           number | null;  // null for large sets
    pageSize:        number;
  };
}
export const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64');
export const decodeCursor = (c: string): { createdAt: Date; id: string } => {
  const { createdAt, id } = JSON.parse(Buffer.from(c, 'base64').toString('utf8'));
  return { createdAt: new Date(createdAt), id };
};
```
Apply to: `GET /api/v2/audit`, `GET /api/v2/dlq`, `GET /api/v1/team`, `GET /api/v1/documents`.

---

## GAP-05: CIT Annual Assessment — Entirely Missing

**Problem:** Compliance calendar surfaces CIT deadlines but no filing wizard, tax math, or preflight checks exist. CIT is the highest-value obligation for companies above ₦100M turnover.

**`packages/contracts/src/cit.ts`** — C-41: only CIT computation path:
```typescript
export const SMALL_CO_CIT_THRESHOLD = 100_000_000;
export const CIT_LARGE_RATE          = 0.30;
export const DEV_LEVY_RATE           = 0.04;
export const EDUCATION_TAX_RATE      = 0.025;

export function calculateCIT(input: {
  turnover: number; profit: number; devLevyApplies: boolean; taxLossCarryforward?: number;
}): CITResult {
  const { turnover, profit, devLevyApplies, taxLossCarryforward = 0 } = input;
  if (turnover < SMALL_CO_CIT_THRESHOLD)
    return { rate:0, taxableProfit:0, citLiability:0, devLevy:0, educationTax:0, total:0, band:'small' };
  const tp = Math.max(0, profit - taxLossCarryforward);
  const cl = tp * CIT_LARGE_RATE, dl = devLevyApplies ? tp * DEV_LEVY_RATE : 0, et = tp * EDUCATION_TAX_RATE;
  return { rate:CIT_LARGE_RATE, taxableProfit:tp, citLiability:cl, devLevy:dl, educationTax:et, total:cl+dl+et, band:'large' };
}
```

**`mobile/src/screens/filings/CITFilingWizard.tsx`** — MOD-28, 6-step wizard:
```
Step 1: Tax year + turnover — auto-warn if approaching ₦100M (APPROACHING_CIT_THRESHOLD)
Step 2: P&L upload — audited accounts required
Step 3: Tax loss carryforward — read from TaxLossCarryforward DB records
Step 4: Dev Levy eligibility — technology company classification
Step 5: Education Tax — 2.5% of assessable profit
Step 6: CIT assessment summary → Flutterwave payment → receipt
WCAG: step announcement + error focus on all 6 steps (GAP-08)
```

**`backend/src/routes/v1/filings/cit.ts`** — `authenticate + resolveOrgContext + requireRole('ACCOUNTANT') + validate(CITSchema) + idempotency`. Uses `calculateCIT()` exclusively (C-41).

CI accuracy gates:
```bash
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:200_000_000,profit:50_000_000,devLevyApplies:false}).citLiability!==15_000_000)process.exit(1)"
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:80_000_000,profit:20_000_000,devLevyApplies:false}).citLiability!==0)process.exit(1)"
```

---

## GAP-06: Flutterwave Webhook — No Idempotency Guard

**Problem:** HMAC validation is specified but no idempotency guard exists. Flutterwave replays webhooks on non-200 responses, causing double-credit, duplicate audit events, and corrupted subscription state.

**`backend/src/routes/webhooks/flutterwave.ts`** — C-37: Redis `NX` guard before any DB write:
```typescript
router.post('/flutterwave', express.raw({ type:'application/json' }), async (req, res) => {
  const sig      = req.headers['verif-hash'] as string;
  const expected = crypto.createHmac('sha256', process.env.FLUTTERWAVE_SECRET!)
    .update((req.body as Buffer).toString('utf8')).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return res.status(401).end();

  const event = JSON.parse((req.body as Buffer).toString('utf8'));
  const key   = `webhook:flw:${event.data?.tx_ref}`;
  if (!await redis.set(key, '1', 'NX', 'EX', 86400))
    return res.status(200).json({ status:'already_processed' });  // C-37

  setImmediate(async () => {
    try { await processFlutterwaveEvent(event, prisma); }
    catch (e) { Sentry.captureException(e); await redis.del(key); }
  });
  res.status(200).json({ status:'accepted' });
});
```

---

## GAP-07: Deep Linking — No Configuration or Route Allowlist

**Problem:** Push notifications embed `data.route` for deep linking, but no Expo Router scheme, universal link setup, or route allowlist is specified. Tapping a notification opens the app home screen rather than the intended route.

**`mobile/app.json`** — update:
```json
{
  "expo": {
    "scheme": "taxbridge",
    "ios": { "associatedDomains": ["applinks:app.taxbridge.ng"] },
    "android": {
      "intentFilters": [{"action":"VIEW","autoVerify":true,"data":[{"scheme":"https","host":"app.taxbridge.ng"}],"category":["BROWSABLE","DEFAULT"]}],
      "notification": { "androidMode": "collapse" }
    },
    "plugins": [["expo-notifications", { "androidMode": "collapse" }]]
  }
}
```

**`mobile/src/hooks/useDeepLink.ts`** — C-36: allowlist-only navigation:
```typescript
const SAFE_ROUTES = ['/dashboard','/filings/vat','/filings/wht','/filings/paye',
                     '/filings/nil','/filings/cit','/documents','/team','/profile/security'];
export function useDeepLink() {
  const router = useRouter();
  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) navigate(url, router); });
    const sub = Linking.addEventListener('url', ({ url }) => navigate(url, router));
    return () => sub.remove();
  }, [router]);
}
function navigate(url: string, router: ReturnType<typeof useRouter>) {
  const { path } = Linking.parse(url);
  if (path && SAFE_ROUTES.some(r => path.startsWith(r))) router.push(path as never);
}
```
Call `useDeepLink()` in App root.

---

## GAP-08: WCAG 2.2 AA — Filing Wizards Unspecified

**Problem:** WCAG 2.2 AA is required in the master prompt for dashboard components but is absent from all filing wizard specifications. Screen reader users cannot navigate multi-step wizards without focus management, step announcements, and accessible error linkage.

**Mandatory pattern for all filing wizards** (`VATFilingWizard`, `WHTWizard`, `PAYEWizard`, `NILReturnScreen`, `CITFilingWizard`):
```typescript
// Step announcement
useEffect(() => {
  AccessibilityInfo.announceForAccessibility(`Step ${currentStep} of ${totalSteps}: ${stepTitle}`);
}, [currentStep]);

// Error focus
const firstErrorRef = useRef<TextInput>(null);
useEffect(() => {
  if (errors.length > 0) {
    firstErrorRef.current?.focus();
    AccessibilityInfo.announceForAccessibility(
      `${errors.length} error${errors.length > 1 ? 's' : ''}: ${errors[0].message}`);
  }
}, [errors]);

// Progress indicator
<View accessibilityRole="progressbar"
  accessibilityLabel={`Step ${currentStep} of ${totalSteps}`}
  accessibilityValue={{ min:1, max:totalSteps, now:currentStep }} />

// All form fields: accessibilityLabel + accessibilityHint + accessibilityErrorMessage + aria-invalid
// All interactive elements: minimum 44×44px touch target
```

---

## GAP-09: Rate Limit Headers — Not Exposed

**Problem:** Rate limiting is configured but clients receive 429 responses with no retry timing, causing poor UX and uncoordinated retry storms on 2G connections.

**`backend/src/middleware/rateLimit.ts`** — all limiters must include:
```typescript
standardHeaders: true,   // Exposes RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
legacyHeaders:   false,  // Disables deprecated X-RateLimit-* headers
```
Mobile client on 429: toast `"Too many requests — try again in ${retryAfterSeconds}s"`. Never auto-retry on 429 — requires explicit user action.

---

## GAP-10: PgBouncer Connection Pooling — Not Configured

**Problem:** V12 targets 2,000 concurrent users. Render PostgreSQL free tier limits connections to 25. Without PgBouncer, a load spike exhausts the pool and returns universal 500 errors.

**`backend/src/lib/prisma.ts`** — C-43: singleton only:
```typescript
import { PrismaClient } from '@prisma/client';
declare global { var __prisma: PrismaClient | undefined; }
export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query','error'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
process.on('SIGINT',  () => prisma.$disconnect());
process.on('SIGTERM', () => prisma.$disconnect());
// DATABASE_URL must include: ?pgbouncer=true&connection_limit=1&pool_timeout=20
```
Gate: `grep -rn "new PrismaClient" backend/src/routes` → 0.

---

## GAP-11: 2G Network Resilience — No Backoff or Offline-First Mode

**Problem:** The design target is a Tecno Spark on 2G in Lagos, but `apiClient.ts` has no exponential backoff, timeout, or offline-first configuration. React Query's default `retry:3` fires immediately, overwhelming the queue on 400ms+ RTT.

**`mobile/src/services/apiClient.ts`** — replace:
```typescript
const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL, timeout: 15_000 });
// Response interceptor: 401 → refresh → retry once → router.replace('/auth/login')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:       (n, e: any) => e?.response?.status === 401 || e?.response?.status === 404 ? false : n < 2,
      retryDelay:  n => Math.min(1000 * 2 ** n, 10_000),  // exponential backoff for 2G
      staleTime:   30_000,
      gcTime:      5 * 60_000,
      networkMode: 'offlineFirst',  // serve cache before network on 2G
    },
    mutations: { retry:0, networkMode:'online' },
  },
});
// On 429: toast "Too many requests — try again in ${s}s" — never auto-retry
```

---

## GAP-12: Admin Panel — No CSRF or Role Version Sync

**Problem:** Admin uses `jose` for JWT validation but has no CSRF protection for mutating requests and no mechanism to invalidate sessions when a user's role changes. A downgraded admin retains access until the Next.js session cookie expires.

**`admin/src/middleware.ts`** — replace:
```typescript
import { jwtVerify } from 'jose';
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    // role_version: check Vercel Edge Config (30s TTL); redirect /login?reason=session_expired if changed
    const current = await edgeConfig.get(`role_version:${payload.sub}`);
    if (current && current !== payload.roleVersion) {
      const res = NextResponse.redirect(new URL('/login?reason=session_expired', request.url));
      res.cookies.delete('admin_session');
      return res;
    }
    // CSRF — all mutating requests
    if (['POST','PATCH','DELETE'].includes(request.method)) {
      const csrfCookie = request.cookies.get('csrf_token')?.value;
      const csrfHeader = request.headers.get('X-CSRF-Token');
      if (!csrfCookie || csrfCookie !== csrfHeader)
        return NextResponse.json({ error:'CSRF_INVALID' }, { status:403 });
    }
    return NextResponse.next();
  } catch { return NextResponse.redirect(new URL('/login', request.url)); }
}
export const config = { matcher: ['/admin/:path*'] };
```

---

## GAP-13: VAT Registration Guard — Absent

**Problem:** `constants.ts` defines `VAT_REGISTRATION_THRESHOLD = 25_000_000` but no enforcement exists in the VAT filing wizard. A company with turnover below ₦25M can file VAT returns — a regulatory violation.

**`backend/src/services/compliancePreFlight.ts`** — update:
```typescript
async function checkVATRegistrationStatus(orgId: string): Promise<PreFlightCheck> {
  const org     = await (prisma as any).organisation.findUnique({ where: { id: orgId } });
  const revenue = await computeAnnualRevenue(orgId);
  if (revenue < VAT_REGISTRATION_THRESHOLD)
    return { pass:false, code:'VAT_NOT_REQUIRED',
      message:`Turnover (${formatNGN(revenue)}) is below the ₦25M VAT registration threshold.` };
  if (!org.vatRegistrationNumber)
    return { pass:false, code:'VAT_NOT_REGISTERED',
      message:'Complete VAT registration with NRS before filing VAT returns.' };
  return { pass:true, code:'VAT_REGISTERED', message:'VAT registration verified.' };
}
```
Failures block submission. Warnings are informational only.

`dashboardService.ts` must define `FALLBACK_STATS`, `FALLBACK_ANOMALIES`, `FALLBACK_DEADLINES`, and `FALLBACK_NRS_HEALTH` — every `.catch()` returns the appropriate fallback and never propagates to the HTTP layer (C-07).

---

## GAP-14: Lottie Animations — No Asset Strategy or Fallback

**Problem:** `OnboardingWizard` and filing completion screens reference Lottie animations with no package spec, asset management strategy, or fallback for devices where Lottie fails. Files above 200KB degrade 2G performance if network-loaded.

Package: `yarn workspace mobile add lottie-react-native`

Asset directory — bundle locally, never load from network:
```
mobile/src/assets/animations/
├── confetti.json          < 50KB
├── success-checkmark.json < 30KB
├── loading-spinner.json   < 20KB
└── empty-state.json       < 40KB
```

Minify before bundling:
```bash
node -e "const fs=require('fs'),p=require('path'),d='mobile/src/assets/animations';fs.readdirSync(d).filter(f=>f.endsWith('.json')).forEach(f=>{const fp=p.join(d,f);fs.writeFileSync(fp,JSON.stringify(JSON.parse(fs.readFileSync(fp,'utf8'))))})"
```

**`mobile/src/components/shared/ConfettiAnimation.tsx`** — C-42: `onError` fallback mandatory:
```typescript
function ConfettiAnimation({ onFinish }: { onFinish: () => void }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    useEffect(() => { setTimeout(onFinish, 1500); }, []);
    return <SuccessIcon size={80} color={COLORS.primary} />;
  }
  return (
    <LottieView source={require('../../assets/animations/confetti.json')}
      autoPlay loop={false} onAnimationFinish={onFinish}
      onError={() => { setOk(false); onFinish(); }} />
  );
}
```

---

## GAP-15: PDF Receipt Generation — No Implementation

**Problem:** Filing submission references a signed R2 receipt URL but no PDF generation service, receipt template, or BullMQ queue consumer exists. `TaxReturn.receiptUrl` is null for every filed return.

New packages: `yarn workspace backend add pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

**`backend/src/workers/pdfWorker.ts`** — C-40: always async via BullMQ, never blocks HTTP:
```typescript
export async function generateTaxReceipt(payload: { filingId: string; orgId: string }): Promise<string> {
  const filing = await (prisma as any).taxReturn.findUnique({
    where: { id: payload.filingId }, include: { org: true },
  });
  const doc = new PDFDocument({ size:'A4', margin:50 });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  // A4 receipt: filingReference | taxType | period | nrsIRN | amountPaid | submittedAt
  // Header: TaxBridge logo + "Official Filing Receipt" + ₦1DB954 divider line at y=100
  // Footer: "System-generated receipt. For disputes, contact NRS with the filing reference."
  doc.end();
  await new Promise(r => doc.on('end', r));

  const key = `receipts/${payload.orgId}/${payload.filingId}.pdf`;
  const r2  = new S3Client({ region:'auto', endpoint:process.env.R2_ENDPOINT });
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!, Key: key,
    Body: Buffer.concat(chunks), ContentType:'application/pdf',
    ServerSideEncryption:'aws:kms',
  }));
  const signedUrl = await generateSignedUrl(key, 86400);  // 24h expiry
  await (prisma as any).taxReturn.update({ where:{ id:payload.filingId }, data:{ receiptUrl:signedUrl } });
  return signedUrl;
}
```

**`backend/src/services/eventBus.ts`** — wire:
```typescript
eventBus.on('filing.submitted', payload => pdfQueue.add('generate-receipt', payload, { priority:2 }));
```

Add to `validateEnv.ts` `REQUIRED_PRODUCTION`: `R2_ENDPOINT R2_BUCKET_NAME R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY`

---

# PART III: PHASE EXECUTION ORDER

## Phase Dependency Map
```
P0 (Foundation) ──► P1 (Sprint) ──► P2 (Tax Workflows) ──► P3 (Infrastructure)
     │                   │                  │                        │
     ├─ PgBouncer/Prisma  ├─ 2G API client   ├─ CIT module (MOD-28)   ├─ Docker multi-stage
     ├─ TOTP enrollment   ├─ Deep links      ├─ PDF receipts (C-40)   ├─ Grafana + k6
     ├─ Push infra        ├─ WCAG wizards    ├─ Webhook idempotency   ├─ CI/CD gate updates
     └─ DB: UserDevice    └─ CSRF admin      └─ VAT guard (GAP-13)    └─ Zero-downtime migrate
          + SECURITY_ALERT
```

## Pre-Execution (Day 0)
```bash
git checkout upgrade/v12-elevated-20260302 && git branch --show-current
git log --all -S "SENTRY_DSN" --source --all | grep "REPLACE" | wc -l  # → 0
yarn workspaces foreach -A exec npm audit --audit-level=moderate 2>&1 | tee /tmp/audit-baseline.txt

yarn workspace mobile add @expo-google-fonts/inter expo-font @shopify/flash-list expo-haptics \
  expo-local-authentication @tanstack/react-query@5 lottie-react-native \
  expo-notifications expo-device axios @react-native-community/netinfo

yarn workspace backend add compression @types/compression opossum @types/opossum pino pino-pretty \
  bullmq ioredis @sentry/node express-rate-limit \
  pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  speakeasy qrcode @types/speakeasy @types/qrcode

yarn workspace admin add jose
```

## P0 — Foundation (Days 1–3) — Blocking

Create in this sequence:
1. `backend/src/validateEnv.ts` — add `R2_ENDPOINT,R2_BUCKET_NAME,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY` to `REQUIRED_PRODUCTION`
2. `backend/src/lib/prisma.ts` — PgBouncer singleton (C-43)
3. `backend/src/middleware/validate.ts` | `idempotency.ts` | `require2FA.ts`
4. `backend/src/routes/v1/auth/totp.ts` — all 4 endpoints (GAP-03)
5. `backend/src/routes/v1/auth.ts` — add `handleSuspiciousReuse()` (GAP-02)
6. `backend/src/routes/v1/notifications.ts` — register + unregister (GAP-01)
7. `backend/src/services/notifications.ts` — full send + SMS fallback (GAP-01)
8. `backend/prisma/schema.prisma` — add `UserDevice` model + `SECURITY_ALERT` to `AuditAction` (GAP-01/02)
9. `packages/contracts/src/types.ts` — add `PaginatedResponse<T>`, `encodeCursor`, `decodeCursor` (GAP-04)
10. `mobile/src/hooks/usePushNotification.ts` (GAP-01)
11. `mobile/src/assets/animations/` — all 4 JSON files, minified (GAP-14)
12. `mobile/src/components/shared/ConfettiAnimation.tsx` — with `onError` fallback (GAP-14, C-42)
13. `mobile/src/screens/auth/TOTPSetupScreen.tsx` (GAP-03)

Gate:
```bash
npx prisma migrate dev --name "v12_add_userdevice_security_alert"
yarn workspaces foreach -A run type-check                              # → 0 errors
grep -q "handleSuspiciousReuse" backend/src/routes/v1/auth.ts         # ✅
grep -q "totp/setup" backend/src/routes/v1/auth/totp.ts               # ✅
grep -q "UserDevice" backend/prisma/schema.prisma                      # ✅
grep -q "SECURITY_ALERT" backend/prisma/schema.prisma                  # ✅
grep -q "global.__prisma" backend/src/lib/prisma.ts                    # ✅
```

## P1 — Sprint (Days 4–7) — After P0 Gate

1. `mobile/src/services/apiClient.ts` — exponential backoff + `networkMode:'offlineFirst'` (GAP-11)
2. `mobile/src/hooks/useDeepLink.ts` + `mobile/app.json` update (GAP-07)
3. `backend/src/middleware/rateLimit.ts` — `standardHeaders:true` on all limiters (GAP-09)
4. `admin/src/middleware.ts` — CSRF + role_version sync (GAP-12)
5. All filing wizards — WCAG 2.2 AA pattern (GAP-08)

Gate:
```bash
grep -q "standardHeaders.*true" backend/src/middleware/rateLimit.ts
grep -q "SAFE_ROUTES" mobile/src/hooks/useDeepLink.ts
grep -q 'accessibilityRole="progressbar"' mobile/src/screens/filings/VATFilingWizard.tsx
grep -rn "#[0-9A-Fa-f]\{3,6\}" mobile/src/components --include="*.tsx" | grep -v design-system  # → 0
grep -rn "FlatList" mobile/src --include="*.tsx" | grep -v node_modules                          # → 0
```

## P2 — Tax Workflows (Days 8–14) — After P1 Gate

1. `packages/contracts/src/cit.ts` + `backend/src/routes/v1/filings/cit.ts` + `mobile/src/screens/filings/CITFilingWizard.tsx` (MOD-28, GAP-05)
2. `backend/src/workers/pdfWorker.ts` + eventBus wire (GAP-15, C-40)
3. `backend/src/routes/webhooks/flutterwave.ts` — Redis NX idempotency guard (GAP-06, C-37)
4. `backend/src/services/compliancePreFlight.ts` — VAT registration check (GAP-13)

Per-module additions:
- MOD-22 (VAT): add VAT registration preflight gate before step 9
- MOD-23 (WHT): amber inline alert for professional fee rate — not color alone
- MOD-24 (PAYE): trigger `<ConfettiAnimation/>` on payroll run completion
- MOD-26 (Vault): auto-add PDF receipt to vault on `filing.submitted`
- MOD-27 (Team): `sendPushNotification` to invited user after OTP dispatch

Gate:
```bash
sleep 5 && curl -sf -H "Authorization:Bearer $TOKEN" "$BASE/api/v1/filings/$FID" | jq -e '.receiptUrl|startswith("https://")'
curl -sf "$BASE/api/v1/filings/preflight?taxType=VAT" -H "Authorization:Bearer $SMALL_TOKEN" | jq -e '.checks[]|select(.code=="VAT_NOT_REQUIRED")'
curl -X POST $BASE/webhooks/flutterwave -H "verif-hash:$SIG" -d "$BODY"  # → { status:"accepted" }
curl -X POST $BASE/webhooks/flutterwave -H "verif-hash:$SIG" -d "$BODY"  # → { status:"already_processed" }
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:200_000_000,profit:50_000_000,devLevyApplies:false}).citLiability!==15_000_000)process.exit(1)"
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:80_000_000,profit:20_000_000,devLevyApplies:false}).citLiability!==0)process.exit(1)"
```

## P3 — Infrastructure (Days 15–17)

Execute per APEX directive. Additional CI Stage 1 gates:
```bash
test -f backend/src/workers/pdfWorker.ts
test -f backend/src/routes/v1/notifications.ts
test -f backend/src/routes/v1/auth/totp.ts
grep -q "bcrypt"           backend/src/routes/v1/auth/totp.ts           # C-38
grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts  # C-37
grep -q "global.__prisma"  backend/src/lib/prisma.ts                    # C-43
grep -q "SAFE_ROUTES"      mobile/src/hooks/useDeepLink.ts              # C-36
```

---

# PART IV: COMPLETION CRITERIA — 30 TOTAL

| # | Criterion |
|---|---|
| 1 | Full pre-deployment validation exits 0 |
| 2 | ≥550 tests passing, 0 failing; ≥95% lines/functions, ≥90% branches coverage |
| 3 | PIT: `calculatePIT({grossIncome:5_000_000,rentPaid:600_000,pension:200_000}).taxLiability===632_400 ±₦1` |
| 4 | Penalty: company 32d late ₦0 → `netPenalty===375_000` |
| 5 | CIT: turnover ₦200M/₦50M → `citLiability===15_000_000`; turnover ₦80M → `citLiability===0` |
| 6 | All 9 smoke tests pass in staging |
| 7 | `/prompts/v12_master_prompt.md` committed to repo |
| 8 | `/prompts/v12_production_architecture_module.md` committed to repo |
| 9 | Branch `upgrade/v12-elevated-20260302` passes all 5 CI stages |
| 10 | Zero `SENTRY_DSN` placeholder, `FIRS`, hardcoded `CBN_MPR`, or `console.log` in backend |
| 11 | Admin Lighthouse performance ≥98; dashboard 2G initial paint <2000ms |
| 12 | `anomalyEngine.ts` present; `computeAnomalies` → `[]` on throw, never propagates |
| 13 | `riskScoring.ts` present; score clamped 0–100 before every DB write |
| 14 | opossum circuit breaker in `nrsService.ts`; `nrsCircuitState` metric updates on state change |
| 15 | `validate()` middleware on all POST/PATCH routes |
| 16 | `idempotency` middleware on all exactly-once mutations |
| 17 | `TaxHealthSnapshot` model has NO `updatedAt` field |
| 18 | `/admin/dlq` with retry + resolve controls + 2FA gate for bulk >10 |
| 19 | `/admin/analytics` with all 5 panels |
| 20 | `OnboardingWizard` has resume-on-reconnect path via AsyncStorage |
| 21 | `compression` middleware active in `backend/src/app.ts` |
| 22 | TOTP: `POST /api/v1/auth/totp/setup`, `/verify`, `/disable`, `/backup` all present |
| 23 | `POST /api/v1/notifications/register` present; `UserDevice` model in schema |
| 24 | `SAFE_ROUTES` in `useDeepLink.ts`; no dynamic path injection possible |
| 25 | Flutterwave webhook returns `already_processed` on duplicate `tx_ref` |
| 26 | `pdfWorker.ts` present; `TaxReturn.receiptUrl` populated after `filing.submitted` |
| 27 | `handleSuspiciousReuse()` triggers `SECURITY_ALERT` audit event + push notification |
| 28 | `standardHeaders:true` on all rate limiters |
| 29 | `global.__prisma` singleton in `backend/src/lib/prisma.ts`; zero `new PrismaClient()` in routes |
| 30 | Lottie files bundled + minified in `mobile/src/assets/animations/`; `ConfettiAnimation` has `onError` fallback |

---

# PART V: CONSTRAINTS ADDENDUM — C-36 TO C-43

C-01 through C-35 are defined in the APEX directive and retained without modification.

| Code | Rule | Gate |
|---|---|---|
| C-36 | `useDeepLink()` navigates only to `SAFE_ROUTES` — no dynamic path injection | `grep -q "SAFE_ROUTES" mobile/src/hooks/useDeepLink.ts` |
| C-37 | Flutterwave webhook uses Redis `NX` guard before any DB write | `grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts` |
| C-38 | TOTP backup codes bcrypt-hashed before storage — never plaintext | `grep -q "bcrypt" backend/src/routes/v1/auth/totp.ts` |
| C-39 | All push notification `body` values ≤150 characters — Expo hard limit | lint or test |
| C-40 | PDF receipt generation always async via BullMQ — never blocks HTTP | `grep -q "pdfQueue.add" backend/src/services/eventBus.ts` |
| C-41 | `calculateCIT()` is the only CIT computation path — no inline CIT math | `grep -rn "0\.30.*profit" backend/src mobile/src` → 0 |
| C-42 | `ConfettiAnimation` always has `onError` fallback — never crashes if Lottie fails | `grep -q "onError" mobile/src/components/shared/ConfettiAnimation.tsx` |
| C-43 | Prisma initialized only via `backend/src/lib/prisma.ts` singleton — never `new PrismaClient()` in routes | `grep -rn "new PrismaClient" backend/src/routes` → 0 |

---

# PART VI: RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| NRS API downtime at launch | HIGH | CRITICAL | `DIGITAX_MOCK_MODE=true` + BullMQ retry queue |
| 2G performance regression | MEDIUM | HIGH | FlashList + `networkMode:'offlineFirst'` + 0px skeleton shift |
| TOTP lockout — SUPER_ADMIN loses device | LOW | CRITICAL | 10 bcrypt-hashed one-time backup codes |
| PDF queue backlog under load | MEDIUM | MEDIUM | BullMQ priority 2; UI shows "Receipt generating…" with polling |
| Flutterwave double-credit on replay | MEDIUM | CRITICAL | Redis `NX` idempotency guard (C-37) |
| PgBouncer pool exhaustion | MEDIUM | HIGH | `connection_limit=1` in `DATABASE_URL` |
| CIT small-company misclassification | LOW | HIGH | Preflight warning when approaching ₦100M threshold |
| Expo push token expiry | MEDIUM | MEDIUM | Token refresh on next app open; SMS fallback via Africa's Talking |

---

# APPENDIX A: FILE MANIFEST

**New Files:**

| File | Phase | Gap |
|---|---|---|
| `backend/src/lib/prisma.ts` | P0 | GAP-10, C-43 |
| `backend/src/routes/v1/auth/totp.ts` | P0 | GAP-03, C-38 |
| `backend/src/routes/v1/notifications.ts` | P0 | GAP-01 |
| `backend/src/workers/pdfWorker.ts` | P2 | GAP-15, C-40 |
| `packages/contracts/src/cit.ts` | P2 | GAP-05, C-41 |
| `mobile/src/hooks/usePushNotification.ts` | P0 | GAP-01 |
| `mobile/src/hooks/useDeepLink.ts` | P1 | GAP-07, C-36 |
| `mobile/src/screens/auth/TOTPSetupScreen.tsx` | P0 | GAP-03 |
| `mobile/src/screens/filings/CITFilingWizard.tsx` | P2 | GAP-05, MOD-28 |
| `mobile/src/components/shared/ConfettiAnimation.tsx` | P0 | GAP-14, C-42 |
| `mobile/src/assets/animations/confetti.json` | P0 | GAP-14 |
| `mobile/src/assets/animations/success-checkmark.json` | P0 | GAP-14 |
| `mobile/src/assets/animations/loading-spinner.json` | P0 | GAP-14 |
| `mobile/src/assets/animations/empty-state.json` | P0 | GAP-14 |
| `infra/k6/load-test.js` | P3 | Performance |
| `infra/grafana/dashboard.json` | P3 | Observability |

**Updated Files:**

| File | Phase | Gap |
|---|---|---|
| `backend/src/routes/v1/auth.ts` | P0 | GAP-02 |
| `backend/src/routes/webhooks/flutterwave.ts` | P2 | GAP-06, C-37 |
| `backend/src/middleware/rateLimit.ts` | P1 | GAP-09 |
| `backend/src/services/compliancePreFlight.ts` | P2 | GAP-13 |
| `backend/src/services/eventBus.ts` | P2 | GAP-15 |
| `backend/src/validateEnv.ts` | P0 | GAP-15 |
| `backend/prisma/schema.prisma` | P0 | GAP-01 |
| `mobile/src/services/apiClient.ts` | P1 | GAP-11 |
| `mobile/app.json` | P1 | GAP-07 |
| `admin/src/middleware.ts` | P1 | GAP-12 |
| `packages/contracts/src/types.ts` | P0 | GAP-04 |
| `packages/contracts/src/index.ts` | P2 | GAP-05 |
| `.github/workflows/pipeline.yml` | P3 | All |

---

# APPENDIX B: ENVIRONMENT VARIABLES — COMPLETE MANIFEST

```bash
# REQUIRED_ALWAYS
DATABASE_URL="postgresql://...?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=20"
REDIS_URL="rediss://..."
JWT_SECRET              # RS256 PEM private key (openssl genrsa 4096)
JWT_REFRESH_SECRET      # random 64-char hex
NRS_API_KEY
PORT=10000
NODE_ENV

# REQUIRED_PRODUCTION
SENTRY_DSN
RENDER_EXTERNAL_URL
FLUTTERWAVE_SECRET
CBN_MPR                 # update within 24h of CBN announcement — never hardcode (C-27)
CORS_ORIGIN="https://taxbridge.vercel.app,https://app.taxbridge.ng"
DOCUMENT_VAULT_KMS_PROVIDER=cloudflare
R2_ENDPOINT             # https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=taxbridge-vault
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY

# OPTIONAL
DIGITAX_MOCK_MODE=false # true → bypass NRS circuit breaker
LOG_LEVEL=info
AFRICA_TALKING_API_KEY  # SMS fallback when no push devices registered
AFRICA_TALKING_USERNAME

# EAS SECRETS (eas secret:create — never in eas.json)
SENTRY_DSN
EXPO_PUSH_ACCESS_TOKEN
EXPO_PUBLIC_PROJECT_ID

# GITHUB SECRETS
SMOKE_TEST_EMAIL | SMOKE_TEST_PASSWORD | RENDER_API_KEY | CBN_MPR | VERCEL_TOKEN
```

---

*TaxBridge V12 Enhancement Guide | V12-REFINED-2 | 2026-03-03*
*North Star: A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin.*