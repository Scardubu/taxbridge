---
title: "TaxBridge V12 — Strategic Enhancement Analysis & Implementation Guide"
subtitle: "Gap Analysis, Architecture Upgrades, and Deployment-Ready Execution Plan"
date: "March 2, 2026"
author: "Senior Fintech Engineering & DevSecOps Review"
---

# TaxBridge V12 — Strategic Enhancement Analysis & Implementation Guide

**Classification:** Senior Engineering Artifact  
**Version:** V12-ENHANCED | **Date:** 2026-03-02  
**Scope:** Full-stack gap analysis, DevSecOps hardening, mobile-first UX enhancements, and actionable integration plan  
**Branch:** `upgrade/v12-elevated-20260302`

---

# PART I: EXECUTIVE GAP ANALYSIS

## Overview

After a thorough review of the V12 Master Prompt, Production Architecture Completion Module, and Implementation Prompt, seven critical gap categories were identified. These are not cosmetic issues — they represent production-blocking deficiencies that would prevent a world-class, fully operational Taxbridge platform from being achieved.

## Gap Category Summary

| Category | Gap Count | Risk Level | Phase Impact |
|---|---|---|---|
| Authentication & Session Security | 4 | CRITICAL | P0 |
| API Design & Client Experience | 5 | HIGH | P0–P1 |
| Mobile UX & Accessibility | 6 | HIGH | P0–P1 |
| Tax Workflow Completeness | 4 | CRITICAL | P2 |
| Observability & Alerting | 3 | HIGH | P3 |
| DevSecOps & Supply Chain | 4 | CRITICAL | P3 |
| Data Integrity & Compliance | 3 | HIGH | P0–P2 |

---

# PART II: CRITICAL GAPS & RESOLUTIONS

## GAP-01: Push Notification Infrastructure — Missing End-to-End

**Problem:** The `notifications.ts` service is listed but its implementation contract is undefined. Compliance reminders fire via cron at `09:00 WAT` but there is no specification for the push token registration flow, the notification payload schema, delivery channel fallback (push → SMS → USSD), or Expo push credential management via EAS secrets. Without this, compliance reminder cron jobs silently no-op in production.

**Resolution — New Files Required:**

*`mobile/src/hooks/usePushNotification.ts`*

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing !== 'granted'
    ? await Notifications.requestPermissionsAsync()
    : { status: existing };
  if (status !== 'granted') return null;
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })).data;
  await apiClient.post('/api/v1/notifications/register', { token, platform: Platform.OS });
  return token;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});
```

*`backend/src/routes/v1/notifications.ts`*

```typescript
// POST /api/v1/notifications/register
// Body: { token: string, platform: 'ios' | 'android' }
// Upsert UserDevice record for orgContext.userId
// Deduplication: unique(userId, token)

// POST /api/v1/notifications/unregister
// Soft-delete: set active=false on UserDevice record
```

*`backend/src/services/notifications.ts` — Full specification:*

```typescript
interface NotificationPayload {
  title: string;         // bilingual: served from user lang preference
  body: string;          // max 150 chars — Expo hard limit
  data: {
    route: string;       // deep link: '/filings/vat'
    orgId: string;
    type: 'compliance' | 'anomaly' | 'payment' | 'system';
  };
}

async function sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
  const devices = await (prisma as any).userDevice.findMany({
    where: { userId, active: true },
  });
  if (!devices.length) {
    // Fallback: SMS via Africa's Talking if phoneNumber on record
    await sendSMSFallback(userId, payload.body);
    return;
  }
  const messages = devices.map(d => ({
    to: d.pushToken,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    channelId: payload.data.type === 'compliance' ? 'compliance' : 'general',
  }));
  // Expo push API with chunked sending (max 100 per request)
  const chunks = chunkArray(messages, 100);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
```

*`backend/prisma/schema.prisma` — Add UserDevice model:*

```prisma
model UserDevice {
  id         String   @id @default(cuid())
  userId     String
  pushToken  String
  platform   String   // 'ios' | 'android'
  active     Boolean  @default(true)
  lastSeenAt DateTime @default(now())
  createdAt  DateTime @default(now())
  @@unique([userId, pushToken])
  @@index([userId, active])
}
```

**EAS Secrets — add via CLI:**
```bash
eas secret:create --scope project --name EXPO_PUSH_ACCESS_TOKEN --value <token>
eas secret:create --scope project --name EXPO_PUBLIC_PROJECT_ID --value <project-id>
```

---

## GAP-02: Refresh Token Rotation Attack Vector

**Problem:** The V12 spec defines single-use refresh tokens with session invalidation on reuse, but the implementation gap is in the "suspicious reuse" path. The current spec says "invalidate ALL sessions for userId" on reuse — but there is no push notification, audit event, or admin alert triggered. A credential stuffing attack would be invisible until the legitimate user next logs in.

**Resolution — Update `backend/src/routes/v1/auth.ts`:**

```typescript
// On refresh token reuse detection:
async function handleSuspiciousReuse(userId: string, ip: string): Promise<void> {
  // 1. Invalidate all sessions
  await (prisma as any).userSession.updateMany({
    where: { userId },
    data: { expiresAt: new Date(0) },
  });
  // 2. Increment Redis role_version to force re-auth on all devices
  await redis.del(`role_version:${userId}`);
  // 3. Emit audit event — CRITICAL severity
  await writeAuditEvent({
    orgId: 'SYSTEM',
    actorId: userId,
    actorRole: 'SYSTEM',
    targetType: 'UserSession',
    targetId: userId,
    action: 'SECURITY_ALERT',
    after: { reason: 'refresh_token_reuse', ip },
    ip,
  }, prisma);
  // 4. Send push notification to all registered devices
  await sendPushNotification(userId, {
    title: 'Security Alert',
    body: 'Unusual login activity detected. All sessions have been signed out.',
    data: { route: '/profile/security', orgId: '', type: 'system' },
  });
  // 5. Alert ADMIN via Sentry + Slack webhook
  Sentry.captureMessage('Refresh token reuse detected', {
    level: 'warning',
    extra: { userId, ip },
  });
}
```

---

## GAP-03: TOTP Enrollment Flow — Completely Absent

**Problem:** `require2FA` middleware is specified for SUPER_ADMIN operations, but there is no TOTP enrollment screen, QR code generation endpoint, backup code system, or TOTP verification endpoint defined anywhere in the three documents. The middleware references `totpVerifiedAt` but there is no path for a SUPER_ADMIN to enroll TOTP in the first place.

**Resolution — New files and endpoints required:**

*`backend/src/routes/v1/auth/totp.ts`*

```typescript
// POST /api/v1/auth/totp/setup — generate TOTP secret + QR code
// Requires: authenticate + requireRole('SUPER_ADMIN')
// Returns: { qrCodeDataUrl, secret, backupCodes: string[] (10 codes) }
// Stores: encrypted secret in UserProfile.totpSecret (AES-256-GCM, same KMS)
// Backup codes: bcrypt-hashed, stored in UserProfile.totpBackupCodes (JSON array)

// POST /api/v1/auth/totp/verify — verify TOTP token and mark session
// Body: { token: string } — 6-digit TOTP
// On success: redis.setex(`totp:${userId}`, 300, '1') — 5-minute window
// On failure: increment failure counter; lock after 5 consecutive failures

// POST /api/v1/auth/totp/disable — disable TOTP (requires current TOTP + password)
// Requires: authenticate + requireRole('SUPER_ADMIN') + require2FA
// Audit: await writeAuditEvent action:'UPDATE'

// POST /api/v1/auth/totp/backup — redeem backup code
// Body: { backupCode: string }
// Uses bcrypt.compare against stored hashes; marks code as used (cannot be reused)
```

*`mobile/src/screens/auth/TOTPSetupScreen.tsx`*

```typescript
// Step 1: Show QR code (expo-camera or react-native-qrcode-svg)
// Step 2: User scans with authenticator app
// Step 3: Verify 6-digit token to confirm enrollment
// Step 4: Display 10 backup codes — REQUIRE user to confirm they've saved them
// Step 5: Redirect to dashboard with success toast
// Accessibility: QR code accompanied by manual entry string
```

---

## GAP-04: API Pagination — Cursor vs Offset Mismatch

**Problem:** The spec defines cursor-based pagination for audit logs but does not specify cursor encoding, the `hasNextPage` / `hasPreviousPage` shape, or how the admin frontend implements infinite scroll vs. "next page" buttons. Without a standard, each endpoint will implement pagination differently, creating frontend inconsistencies.

**Resolution — Universal Pagination Contract:**

*`packages/contracts/src/types.ts` — add:*

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor:     string | null;  // base64-encoded {createdAt, id}
    prevCursor:     string | null;
    hasNextPage:    boolean;
    hasPreviousPage: boolean;
    total:          number | null;  // null for large sets (expensive COUNT)
    pageSize:       number;
  };
}

// Cursor encoding/decoding (shared utility):
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64');
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const { createdAt, id } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  return { createdAt: new Date(createdAt), id };
}
```

Applies to: `GET /api/v2/audit`, `GET /api/v2/dlq`, `GET /api/v1/team`, `GET /api/v1/documents`.

---

## GAP-05: CIT Annual Assessment — Entirely Missing

**Problem:** The compliance calendar lists CIT as a deadline event, but there is no CIT filing wizard, CIT calculation logic in `packages/contracts/src/cit.ts`, or CIT-specific preflight checks. An SME approaching ₦100M turnover has no tool to compute their liability. MOD-22 through MOD-27 cover VAT, WHT, PAYE, NIL, documents, and team — but CIT (Company Income Tax) is absent despite being the highest-value obligation.

**Resolution — New Module MOD-28:**

*`packages/contracts/src/cit.ts` — tax math:*

```typescript
// CIT computation per NTA 2025
export function calculateCIT(input: {
  turnover:        number;  // gross revenue
  profit:          number;  // profit before tax
  devLevyApplies: boolean; // technology company: Dev Levy at 4%
  taxLossCarryforward?: number;
}): CITResult {
  const { turnover, profit, devLevyApplies, taxLossCarryforward = 0 } = input;

  // Small company: turnover < ₦100M AND fixed assets ≤ ₦250M → 0%
  if (turnover < SMALL_CO_CIT_THRESHOLD) {
    return { rate: 0, taxableProfit: 0, citLiability: 0, devLevy: 0, total: 0, band: 'small' };
  }

  // Apply tax loss carryforward
  const taxableProfit = Math.max(0, profit - taxLossCarryforward);
  const citLiability = taxableProfit * CIT_LARGE_RATE;  // 30%
  const devLevy = devLevyApplies ? taxableProfit * DEV_LEVY_RATE : 0;  // 4%
  return {
    rate: CIT_LARGE_RATE,
    taxableProfit,
    citLiability,
    devLevy,
    total: citLiability + devLevy,
    band: 'large',
    educationTax: taxableProfit * 0.025,  // Education Tax: 2.5% of assessable profit
  };
}
```

*`mobile/src/screens/filings/CITFilingWizard.tsx`* — 6-step wizard:

```
Step 1: Tax year selection + turnover entry (auto-warn if approaching ₦100M threshold)
Step 2: Profit/loss statement input (with file upload for audited accounts)
Step 3: Tax loss carryforward from TaxLossCarryforward records
Step 4: Dev Levy eligibility check (technology company classification)
Step 5: Education Tax computation (2.5% of assessable profit)
Step 6: CIT assessment summary → Flutterwave payment → filing receipt
```

---

## GAP-06: Webhook Reliability — Flutterwave Idempotency

**Problem:** The Flutterwave webhook handler validates HMAC and processes payments, but there is no idempotency guard for webhook replays. Payment webhooks are replayed by Flutterwave on non-200 responses — without deduplication, a network hiccup between processing and responding could credit a payment twice, corrupt subscription state, or fire duplicate audit events.

**Resolution — Update `backend/src/routes/webhooks/flutterwave.ts`:**

```typescript
router.post('/flutterwave', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. HMAC verification (already specified)
  const received = req.headers['verif-hash'] as string;
  if (!crypto.timingSafeEqual(
    Buffer.from(crypto.createHmac('sha256', process.env.FLUTTERWAVE_SECRET!)
      .update((req.body as Buffer).toString('utf8')).digest('hex')),
    Buffer.from(received),
  )) return res.status(401).end();

  const event = JSON.parse((req.body as Buffer).toString('utf8'));
  const txRef = event.data?.tx_ref;

  // 2. Idempotency guard — CRITICAL: must happen before any processing
  const idempotencyKey = `webhook:flw:${txRef}`;
  const alreadyProcessed = await redis.set(idempotencyKey, '1', 'NX', 'EX', 86400);
  if (!alreadyProcessed) {
    // Already processed — return 200 to stop Flutterwave retrying
    return res.status(200).json({ status: 'already_processed' });
  }

  // 3. Process in background to guarantee fast 200 response to Flutterwave
  setImmediate(async () => {
    try {
      await processFlutterwaveEvent(event, prisma);
    } catch (err) {
      Sentry.captureException(err);
      // Remove idempotency key so retry can be processed
      await redis.del(idempotencyKey);
    }
  });

  res.status(200).json({ status: 'accepted' });
});
```

---

## GAP-07: Mobile Deep Linking — Not Specified

**Problem:** Push notifications include `data.route` for deep linking, and compliance calendar has "File Now" CTAs, but there is no Expo Router deep link configuration, universal link setup (iOS Associated Domains, Android App Links), or email link handling defined. Without this, push notification taps open the app home screen rather than the intended route.

**Resolution — New Files:**

*`mobile/app.json` — add scheme and universal links:*

```json
{
  "expo": {
    "scheme": "taxbridge",
    "ios": {
      "associatedDomains": ["applinks:app.taxbridge.ng"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "app.taxbridge.ng" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

*`mobile/src/hooks/useDeepLink.ts`*

```typescript
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

export function useDeepLink() {
  const router = useRouter();
  useEffect(() => {
    // Handle cold-start deep link
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url, router); });
    // Handle warm-start deep link (app already open)
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url, router));
    return () => sub.remove();
  }, [router]);
}

function handleDeepLink(url: string, router: ReturnType<typeof useRouter>) {
  const { path } = Linking.parse(url);
  // Route whitelist — only navigate to known safe routes
  const SAFE_ROUTES = ['/dashboard', '/filings/vat', '/filings/wht', '/filings/paye',
                       '/filings/nil', '/documents', '/team', '/profile/security'];
  if (path && SAFE_ROUTES.some(r => path.startsWith(r))) {
    router.push(path as never);
  }
}
```

---

## GAP-08: Accessibility — WCAG 2.2 AA Gaps in Filing Wizards

**Problem:** The master prompt specifies WCAG 2.2 AA for dashboard components but the specification is absent for filing wizards, which are the highest-stakes interactions. Users with visual impairments cannot use screen readers effectively on multi-step wizards without focus management, step announcement, and error linkage.

**Resolution — Mandatory accessibility pattern for all filing wizards:**

```typescript
// Step announcement on navigation
useEffect(() => {
  AccessibilityInfo.announceForAccessibility(
    `Step ${currentStep} of ${totalSteps}: ${stepTitle}`
  );
}, [currentStep]);

// Error focus management
const firstErrorRef = useRef<TextInput>(null);
useEffect(() => {
  if (errors.length > 0) {
    firstErrorRef.current?.focus();
    AccessibilityInfo.announceForAccessibility(
      `${errors.length} error${errors.length > 1 ? 's' : ''}: ${errors[0].message}`
    );
  }
}, [errors]);

// Progress indicator
<View
  accessibilityRole="progressbar"
  accessibilityLabel={`Step ${currentStep} of ${totalSteps}`}
  accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
>
  {/* Visual progress bar */}
</View>

// Form field error linkage
<TextInput
  accessibilityLabel="TIN number"
  accessibilityHint="Enter your 8-digit Tax Identification Number"
  accessibilityErrorMessage={errors.tin?.message}
  aria-invalid={!!errors.tin}
/>
```

---

## GAP-09: Rate Limit Headers — Missing Exposure

**Problem:** Rate limiting is configured but clients have no visibility into their limit state. Mobile clients on slow connections may encounter 429 responses with no indication of when they can retry, causing poor UX and retry storms.

**Resolution — Update `backend/src/middleware/rateLimit.ts`:**

```typescript
// Add to all rate limiters:
standardHeaders: true,   // Exposes RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
legacyHeaders: false,    // Disable X-RateLimit-* legacy headers

// Mobile client consumption in apiClient.ts:
function handleRateLimitResponse(response: Response): number | null {
  const resetHeader = response.headers.get('RateLimit-Reset');
  return resetHeader ? parseInt(resetHeader) * 1000 - Date.now() : null;
}

// UI feedback:
// On 429: toast "Too many requests — try again in ${retryAfterSeconds}s"
// Do NOT auto-retry on 429 — requires explicit user action
```

---

## GAP-10: Database Connection Pooling — Missing for Scale

**Problem:** The V12 architecture targets 2,000 concurrent users in load testing, but there is no PgBouncer connection pooling specification. Render's PostgreSQL free tier limits connections to 25. With `prisma.$connect()` creating one connection per worker process, a load spike will immediately exhaust the pool and return 500 errors to all users.

**Resolution:**

*`backend/src/lib/prisma.ts` — connection pooling configuration:*

```typescript
import { PrismaClient } from '@prisma/client';

declare global { var __prisma: PrismaClient | undefined; }

export const prisma = global.__prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // PgBouncer mode: use ?pgbouncer=true&connection_limit=1 in DATABASE_URL
      // This disables prepared statements (incompatible with PgBouncer)
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

// Graceful shutdown
process.on('SIGINT', () => prisma.$disconnect());
process.on('SIGTERM', () => prisma.$disconnect());
```

*`render.yaml` — add PgBouncer as sidecar (or use Render's built-in pooler):*

```yaml
# In DATABASE_URL, append connection pooling params:
# postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1&pool_timeout=20
```

*`.env.example` — document the pattern:*

```bash
# For Render PostgreSQL with PgBouncer:
DATABASE_URL="postgresql://user:pass@host:5432/taxbridge?pgbouncer=true&connection_limit=1"
```

---

## GAP-11: Nigeria-Specific Network Resilience — 2G Retry Strategy

**Problem:** The design target is "a first-time filer on a Tecno Spark, on 2G in Lagos" but the API client has no exponential backoff, timeout configuration, or network-aware retry strategy. React Query's default `retry: 3` fires all three retries immediately, overwhelming the queue on a 400ms RTT connection.

**Resolution — Update `mobile/src/services/apiClient.ts`:**

```typescript
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15_000,  // 15s — accounts for 2G RTT + server processing
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach auth token
api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 token refresh
api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        error.config.headers.Authorization = `Bearer ${refreshed}`;
        return api.request(error.config);
      }
      // Refresh failed: redirect to login
      router.replace('/auth/login');
    }
    return Promise.reject(error);
  }
);

// React Query global config — 2G-aware:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;  // No retry on auth errors
        if (error?.response?.status === 404) return false;  // No retry on not found
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10_000),  // Exponential backoff
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      networkMode: 'offlineFirst',  // Serve cache before network on 2G
    },
    mutations: {
      retry: 0,  // Never auto-retry mutations — requires explicit user action
      networkMode: 'online',
    },
  },
});
```

---

## GAP-12: Admin Panel Authentication — Edge Runtime Gap

**Problem:** The admin panel uses `jose` for Edge Runtime JWT validation, but there is no specification for the admin login flow, CSRF protection, or session invalidation when a backend `role_version` changes. An admin whose role is downgraded by a SUPER_ADMIN would continue to have admin access until their Next.js session cookie expires.

**Resolution — Update `admin/src/middleware.ts`:**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );

    // Verify role_version against backend (cached in Vercel Edge Config for 30s)
    const roleVersionKey = `role_version:${payload.sub}`;
    const cachedVersion = await edgeConfig.get(roleVersionKey);

    if (cachedVersion && cachedVersion !== payload.roleVersion) {
      // Role changed — force re-authentication
      const response = NextResponse.redirect(new URL('/login?reason=session_expired', request.url));
      response.cookies.delete('admin_session');
      return response;
    }

    // Add CSRF header to all mutating requests
    if (['POST','PATCH','DELETE'].includes(request.method)) {
      const csrfToken = request.cookies.get('csrf_token')?.value;
      const csrfHeader = request.headers.get('X-CSRF-Token');
      if (!csrfToken || csrfToken !== csrfHeader) {
        return NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 });
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

---

## GAP-13: VAT Relief for Small Companies — Logic Gap

**Problem:** The NTA 2025 includes a VAT relief provision for companies with turnover below ₦25M (exemption from registration). The `constants.ts` defines `VAT_REGISTRATION_THRESHOLD = 25_000_000` but there is no enforcement point in the VAT filing wizard that checks registration status before allowing output VAT to be filed. An unregistered company could file VAT returns, which constitutes regulatory fraud.

**Resolution — Update `backend/src/routes/v1/compliance/preflight.ts`:**

```typescript
// checkVATRegistrationStatus enhancement:
async function checkVATRegistrationStatus(orgId: string): Promise<PreFlightCheck> {
  const org = await (prisma as any).organisation.findUnique({ where: { id: orgId } });
  const currentYearRevenue = await computeAnnualRevenue(orgId);

  if (currentYearRevenue < VAT_REGISTRATION_THRESHOLD) {
    return {
      pass: false,
      code: 'VAT_NOT_REQUIRED',
      message: `Your turnover (${formatNGN(currentYearRevenue)}) is below the ₦25M VAT registration threshold. File a NIL return or confirm voluntary registration.`,
      warning: false,
    };
  }
  if (!org.vatRegistrationNumber) {
    return {
      pass: false,
      code: 'VAT_NOT_REGISTERED',
      message: 'You must complete VAT registration with NRS before filing VAT returns.',
      warning: false,
    };
  }
  return { pass: true, code: 'VAT_REGISTERED', message: 'VAT registration verified.' };
}
```

---

## GAP-14: Lottie Animation Dependency — Missing Spec

**Problem:** Both the OnboardingWizard and filing completion screens reference "Confetti Lottie" but there is no package specification, animation asset management strategy, or fallback for devices where Lottie rendering fails. Lottie files can be 200KB+, which impacts 2G performance if loaded from network.

**Resolution:**

*Package:* `yarn workspace mobile add lottie-react-native`

*Asset strategy:* Bundle Lottie JSON in `mobile/src/assets/animations/` (not loaded from network):

```
mobile/src/assets/animations/
├── confetti.json         # < 50KB — filing completion, onboarding completion
├── success-checkmark.json  # < 30KB — NRS stamp success
├── loading-spinner.json  # < 20KB — NRS submission pending
└── empty-state.json      # < 40KB — empty document vault
```

*Compress assets before bundling:* `scripts/compress-assets.sh` must include:
```bash
# Minify Lottie JSON (removes editor metadata, reduces size ~30%)
for f in mobile/src/assets/animations/*.json; do
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$f','utf8'));fs.writeFileSync('$f',JSON.stringify(j))"
done
```

*Fallback component:*

```typescript
function ConfettiAnimation({ onFinish }: { onFinish: () => void }) {
  const [lottieAvailable, setLottieAvailable] = useState(true);
  if (!lottieAvailable) {
    // Fallback: simple CSS-like animation using Animated API
    useEffect(() => { setTimeout(onFinish, 1500); }, []);
    return <SuccessIcon size={80} color={COLORS.primary} />;
  }
  return (
    <LottieView
      source={require('../assets/animations/confetti.json')}
      autoPlay
      loop={false}
      onAnimationFinish={onFinish}
      onError={() => { setLottieAvailable(false); onFinish(); }}
    />
  );
}
```

---

## GAP-15: Tax Receipt PDF Generation — No Specification

**Problem:** The filing submission flow mentions "Download receipt → signed R2 URL" but there is no specification for the PDF generation service, the receipt template, or the BullMQ `pdf-generation` queue consumer. Without this, the receipt URL is null for every filed return, and the Document Vault stores empty records.

**Resolution — New files:**

*`backend/src/workers/pdfWorker.ts`*

```typescript
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface TaxReceiptPayload {
  filingId: string;
  orgId:    string;
  userId:   string;
}

export async function generateTaxReceipt(payload: TaxReceiptPayload): Promise<string> {
  const filing = await (prisma as any).taxReturn.findUnique({
    where: { id: payload.filingId },
    include: { org: true },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk));

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('TaxBridge', 50, 50);
  doc.fontSize(14).font('Helvetica').text('Official Filing Receipt', 50, 80);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#1DB954').lineWidth(2).stroke();

  // Filing details
  doc.fontSize(11).font('Helvetica-Bold').text('Filing Reference:', 50, 120);
  doc.font('Helvetica').text(filing.filingReference, 200, 120);
  doc.font('Helvetica-Bold').text('Tax Type:', 50, 140);
  doc.font('Helvetica').text(filing.taxType, 200, 140);
  doc.font('Helvetica-Bold').text('Period:', 50, 160);
  doc.font('Helvetica').text(filing.period, 200, 160);
  doc.font('Helvetica-Bold').text('NRS IRN:', 50, 180);
  doc.font('Helvetica').text(filing.nrsIRN ?? 'Pending NRS stamp', 200, 180);
  doc.font('Helvetica-Bold').text('Amount Paid:', 50, 200);
  doc.font('Helvetica').text(
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })
      .format(filing.taxAmountDue), 200, 200
  );
  doc.font('Helvetica-Bold').text('Filed At:', 50, 220);
  doc.font('Helvetica').text(filing.submittedAt?.toISOString() ?? '', 200, 220);

  // Footer
  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text('This receipt is a system-generated document. For disputes, contact NRS with the filing reference above.', 50, 720, { width: 495, align: 'center' });

  doc.end();
  await new Promise(resolve => doc.on('end', resolve));

  const pdfBuffer = Buffer.concat(chunks);
  const key = `receipts/${payload.orgId}/${payload.filingId}.pdf`;

  // Upload to Cloudflare R2 (encrypted at rest via KMS)
  const r2 = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT });
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'aws:kms',
  }));

  // Update TaxReturn.receiptUrl with signed URL path (not direct R2 URL)
  const signedUrl = await generateSignedUrl(key, 86400);  // 24h expiry
  await (prisma as any).taxReturn.update({
    where: { id: payload.filingId },
    data: { receiptUrl: signedUrl },
  });

  return signedUrl;
}
```

*Package additions:*
```bash
yarn workspace backend add pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

*Environment variables — add to `validateEnv.ts` REQUIRED_PRODUCTION:*
```bash
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=taxbridge-vault
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
```

---

# PART III: ENHANCED IMPLEMENTATION PLAN

## Phase Dependency Map

```
P0 (Foundation) ──► P1 (Sprint) ──► P2 (Tax Workflows) ──► P3 (Infrastructure)
     │                   │                  │                        │
     ├─ Design System     ├─ Push Notifs     ├─ CIT Module            ├─ Docker
     ├─ Auth Security     ├─ Deep Links      ├─ PDF Receipts          ├─ PgBouncer
     ├─ TOTP Enrollment   ├─ Accessibility   ├─ WHT + VAT fixes       ├─ Grafana
     └─ DB Schema         └─ Rate Limit UX   └─ Webhook idem.         └─ Load Test
```

---

## STEP 1: Pre-Execution Security Baseline

**Duration:** 2 hours | **Blocking:** All other steps depend on this

```bash
# 1a. Verify no secrets in git history
git log --all --full-history -- "*.env" | head -20
git log --all -S "SENTRY_DSN" --source --all | head -10
# If any found: BFG Repo Cleaner required before any further commits

# 1b. Verify dependency audit baseline
yarn workspaces foreach -A exec npm audit --audit-level=moderate 2>&1 | tee /tmp/audit-baseline.txt
# Document all known vulnerabilities before starting — new ones introduced by V12 deps will surface

# 1c. Install all V12 dependencies
yarn workspace mobile add @expo-google-fonts/inter expo-font @shopify/flash-list \
  expo-haptics expo-local-authentication @tanstack/react-query@5 \
  lottie-react-native expo-notifications expo-device axios

yarn workspace backend add compression @types/compression opossum @types/opossum \
  pino pino-pretty bullmq ioredis @sentry/node express-rate-limit \
  pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  speakeasy qrcode @types/speakeasy @types/qrcode

yarn workspace admin add jose

# 1d. Verify all 8 pre-execution gates pass
yarn prompts:verify
grep -rn "FIRS" backend/src mobile/src admin/src packages --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules
# ... (all 8 gates from §3 of master prompt)
```

---

## STEP 2: Enhanced P0 — Foundation with Security Fixes

**Duration:** 3–4 days | **Gate:** All P0.9 checks + GAP-01 through GAP-03 resolved

### 2a. Design System & Tokens (Day 1)

Execute P0.2 as specified, then add:

```bash
# Create animation assets
mkdir -p mobile/src/assets/animations
# Copy/download Lottie JSON files to this directory
# Run compression script:
node -e "
  const fs = require('fs'), path = require('path');
  const dir = 'mobile/src/assets/animations';
  fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
    const full = path.join(dir, f);
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    fs.writeFileSync(full, JSON.stringify(json));
    console.log('Minified:', f, '->', fs.statSync(full).size, 'bytes');
  });
"
```

### 2b. Auth & Security Foundation (Day 1–2)

Order matters — create in this sequence:

1. `backend/src/validateEnv.ts` — add `R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY` to REQUIRED_PRODUCTION
2. `backend/src/lib/prisma.ts` — connection pool singleton (PgBouncer-compatible)
3. `backend/src/middleware/validate.ts`
4. `backend/src/middleware/idempotency.ts`
5. `backend/src/middleware/require2FA.ts` — check `redis.get(`totp:${userId}`)` exists
6. `backend/src/routes/v1/auth/totp.ts` — enrollment, verify, disable, backup redemption
7. Update `backend/src/routes/v1/auth.ts` — add `handleSuspiciousReuse()` to refresh token path
8. `backend/prisma/schema.prisma` — add `UserDevice` model and all V12 models

Gate:
```bash
yarn workspace backend run type-check                         # 0 errors
grep -q "totp_setup\|totp_verify" backend/src/routes/v1/auth/totp.ts  # TOTP routes present
grep -q "handleSuspiciousReuse" backend/src/routes/v1/auth.ts         # Reuse detection present
```

### 2c. Push Notifications (Day 2)

```bash
# Backend
# Create backend/src/routes/v1/notifications.ts
# Create backend/prisma schema UserDevice model
# Run migration:
npx prisma migrate dev --name "v12_add_user_device_push_tokens"

# Mobile
# Create mobile/src/hooks/usePushNotification.ts
# Add to mobile/src/screens/HomeScreen or App root:
#   await registerForPushNotifications()
# Add to app.json: notification channel config for Android
```

### 2d. Database Schema — Full V12 (Day 2–3)

```bash
# Apply all schema changes (additive only — zero NOT NULL without defaults)
npx prisma migrate dev --name "v12_foundation_schema"
npx prisma generate
yarn workspaces foreach -A run type-check  # must be 0 errors
```

Gate: All models present, all indexes defined, `AuditEvent` has NO `updatedAt`, `TaxHealthSnapshot` has NO `updatedAt`.

---

## STEP 3: Enhanced P1 — Sprint Enhancements with Gap Fixes

**Duration:** 3–4 days | **Gate:** All P1.G checks + new accessibility + deep link checks

### 3a. API Client Hardening (Day 1)

Replace `mobile/src/services/apiClient.ts` with the 2G-resilient version from GAP-11:

```bash
# Verify retry configuration:
node -e "
  const src = require('fs').readFileSync('mobile/src/services/apiClient.ts', 'utf8');
  if (!src.includes('retryDelay')) throw new Error('Missing exponential backoff');
  if (!src.includes('networkMode')) throw new Error('Missing offline-first mode');
  console.log('✅ API client 2G-resilient');
"
```

### 3b. Deep Link Infrastructure (Day 1)

```bash
# 1. Update mobile/app.json with scheme + universal links
# 2. Create mobile/src/hooks/useDeepLink.ts
# 3. Call useDeepLink() in mobile/src/App.tsx root component
# 4. Test deep links:
npx uri-scheme open "taxbridge://filings/vat" --android
npx uri-scheme open "taxbridge://filings/vat" --ios
```

### 3c. Rate Limit Headers (Day 1)

Update all rate limiter configs in `backend/src/middleware/rateLimit.ts`:
```bash
grep -q "standardHeaders: true" backend/src/middleware/rateLimit.ts && echo "✅" || echo "❌ Missing rate limit headers"
```

### 3d. Accessibility Audit (Day 2–3)

For every filing wizard screen, enforce:
- `useEffect` announces step changes via `AccessibilityInfo.announceForAccessibility`
- All form fields have `accessibilityLabel`, `accessibilityHint`
- Error fields have `accessibilityErrorMessage` and `aria-invalid`
- Minimum touch target 44×44px on all interactive elements
- Wizard progress indicator has `accessibilityRole="progressbar"` with value

```bash
# Automated accessibility check (add to CI Stage 1):
yarn workspace mobile exec eslint --rule '{"jsx-a11y/interactive-supports-focus": "error"}' src/
```

---

## STEP 4: Enhanced P2 — Complete Tax Workflow Modules

**Duration:** 5–7 days | **Gate:** All P2 checks + CIT + PDF receipts + webhook idempotency

### 4a. CIT Module (MOD-28) — Day 1–2

Execution sequence:

1. Add `calculateCIT()` to `packages/contracts/src/cit.ts`
2. Export from `packages/contracts/src/index.ts`
3. Add `TaxLossCarryforward` model to schema (already specified — verify present)
4. Create `mobile/src/screens/filings/CITFilingWizard.tsx` (6-step)
5. Create `backend/src/routes/v1/filings/cit.ts`

Accuracy gate (add to CI Stage 1):
```bash
npx ts-node -e "
  const {calculateCIT} = require('./packages/contracts/src');
  // Large company: ₦200M turnover, ₦50M profit, no dev levy
  const r = calculateCIT({turnover:200_000_000, profit:50_000_000, devLevyApplies:false});
  if(r.citLiability !== 15_000_000) throw new Error('CIT GATE FAILED: ' + r.citLiability);
  // Small company: ₦80M turnover → 0% CIT
  const s = calculateCIT({turnover:80_000_000, profit:20_000_000, devLevyApplies:false});
  if(s.citLiability !== 0) throw new Error('Small company CIT should be 0');
  console.log('✅ CIT gate passed');
"
```

### 4b. PDF Receipt Generation (Day 2–3)

1. Create `backend/src/workers/pdfWorker.ts` with `generateTaxReceipt()` from GAP-15
2. Connect to `filing.submitted` event in `backend/src/services/eventBus.ts`:
   ```typescript
   eventBus.on('filing.submitted', async ({ filingId, orgId, userId }) => {
     await pdfQueue.add('generate-receipt', { filingId, orgId, userId }, { priority: 2 });
   });
   ```
3. Add `R2_*` environment variables to `validateEnv.ts` and `render.yaml`

Gate:
```bash
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/filings/$FILING_ID/receipt" | jq -e '.receiptUrl | startswith("https://")'
```

### 4c. Webhook Idempotency (Day 3)

Update `backend/src/routes/webhooks/flutterwave.ts` with the idempotency guard from GAP-06.

Gate:
```bash
# Simulate duplicate webhook:
BODY='{"data":{"tx_ref":"test-ref-001","status":"successful"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$FLUTTERWAVE_SECRET" -hex | awk '{print $2}')
curl -X POST $BASE/webhooks/flutterwave -H "verif-hash: $SIG" -H "Content-Type: application/json" -d "$BODY"
# First call → 200 accepted
# Second call → 200 already_processed (NOT a duplicate DB write)
```

### 4d. VAT Registration Guard (Day 4)

Update `backend/src/services/compliancePreFlight.ts` with the VAT registration status check from GAP-13.

### 4e. Remaining V12 Modules (Day 4–7)

Execute MOD-22 through MOD-27 as specified in the implementation prompt, with these additions:

- MOD-22 (VAT): Add preflight gate before step 9
- MOD-23 (WHT): Add professional fee 10% warning as inline alert (amber, not just color)
- MOD-25 (PAYE): Add Lottie success animation on payroll run completion
- MOD-26 (Vault): Wire PDF receipts into vault on filing.submitted event
- MOD-27 (Team): Add push notification to invited user after `OTP` dispatch

---

## STEP 5: Enhanced P3 — Infrastructure & Observability

**Duration:** 2–3 days

### 5a. Docker Multi-Stage (Day 1)

Create `backend/Dockerfile` as specified, then verify:
```bash
docker build --target production -t taxbridge-api:test .
docker run --rm -p 10000:10000 \
  -e DATABASE_URL="postgresql://test" \
  -e REDIS_URL="redis://test" \
  taxbridge-api:test &
sleep 5
curl -sf http://localhost:10000/api/v2/monitoring/health | jq '.status'
docker stop $(docker ps -q --filter ancestor=taxbridge-api:test)
```

### 5b. CI/CD Pipeline — Enhanced Gates (Day 1–2)

Add to `.github/workflows/pipeline.yml` Stage 1:
```yaml
# New gates from gap analysis:
- name: CIT accuracy gate
  run: npx ts-node -e "const {calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:200_000_000,profit:50_000_000,devLevyApplies:false}).citLiability!==15_000_000)process.exit(1)"

- name: PDF worker present
  run: test -f backend/src/workers/pdfWorker.ts && grep -q "generateTaxReceipt" backend/src/workers/pdfWorker.ts

- name: Push notification service present
  run: test -f backend/src/routes/v1/notifications.ts && grep -q "register" backend/src/routes/v1/notifications.ts

- name: Deep link hook present
  run: test -f mobile/src/hooks/useDeepLink.ts && grep -q "SAFE_ROUTES" mobile/src/hooks/useDeepLink.ts

- name: Webhook idempotency guard present
  run: grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts

- name: Rate limit headers enabled
  run: grep -q "standardHeaders.*true" backend/src/middleware/rateLimit.ts

- name: TOTP enrollment endpoint present
  run: test -f backend/src/routes/v1/auth/totp.ts && grep -q "totp/setup" backend/src/routes/v1/auth/totp.ts

- name: PgBouncer-compatible prisma config
  run: test -f backend/src/lib/prisma.ts && grep -q "global.__prisma" backend/src/lib/prisma.ts
```

### 5c. Load Testing Configuration (Day 2)

Create `infra/k6/dashboard-load-test.js` as specified in architecture module §13.3, plus add:

```javascript
// New: filing submission load test
export function filingTest() {
  const idempKey = `load-test-nil-${__VU}-${__ITER}`;
  const res = http.post(`${__ENV.BASE_URL}/api/v1/filings/nil`,
    JSON.stringify({ taxType: 'VAT', period: '2026-02', nilReason: 'NO_REVENUE_THIS_PERIOD' }),
    {
      headers: {
        Authorization: `Bearer ${__ENV.TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempKey,
      },
      tags: { url: 'nil_filing' },
    }
  );
  check(res, {
    'nil filing 200': r => r.status === 200 || r.status === 409,  // 409 = idempotent replay
    'has filing reference': r => JSON.parse(r.body).filingReference !== undefined,
  });
}
```

### 5d. Grafana Dashboard Configuration (Day 2–3)

In addition to the 5 alert rules, create `infra/grafana/dashboard.json` with panels:

```json
{
  "title": "TaxBridge Production Overview",
  "panels": [
    { "title": "API Error Rate (5xx)", "type": "timeseries", "expr": "rate(taxbridge_api_request_duration_seconds_count{status=~\"5..\"}[5m])" },
    { "title": "Dashboard P99 Latency", "type": "gauge", "expr": "histogram_quantile(0.99, taxbridge_api_request_duration_seconds_bucket{route=\"/api/v1/dashboard\"}[5m])", "thresholds": [{"color":"green","value":0},{"color":"yellow","value":0.5},{"color":"red","value":2}] },
    { "title": "NRS Circuit State", "type": "stat", "expr": "taxbridge_nrs_circuit_state", "mappings": [{"value":0,"text":"Closed ✓"},{"value":1,"text":"Half-Open ⚠️"},{"value":2,"text":"OPEN ❌"}] },
    { "title": "DLQ Depth by Queue", "type": "bargauge", "expr": "taxbridge_dlq_depth" },
    { "title": "Filing Submissions (Last Hour)", "type": "stat", "expr": "increase(taxbridge_nrs_stamp_success_total[1h])" },
    { "title": "Active Users (Last 15m)", "type": "stat", "expr": "count(increase(taxbridge_api_request_duration_seconds_count{route=~\"/api/v1/.*\"}[15m]) > 0)" }
  ]
}
```

---

## STEP 6: Full Pre-Deployment Validation (Enhanced)

```bash
# ─── ORIGINAL GATES (unchanged) ───
grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules
grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src | grep -v animation.ts
grep -rn "CRA\b\|consolidatedRelief\|minTax" packages/contracts/src --include="*.ts"
grep -rn "console\.log" backend/src --include="*.ts"
grep -rn "0\.2725\b" packages/contracts/src backend/src
grep '"SENTRY_DSN": "REPLACE' mobile/eas.json
grep -rn "schema\.parse(" backend/src/routes --include="*.ts"
grep 'zone="' mobile/src/screens/DashboardScreen.tsx | wc -l   # → 5
grep '"compileSdkVersion": 36' mobile/eas.json | wc -l          # → 3
grep -rn "FlatList" mobile/src --include="*.tsx" | grep -v node_modules
yarn workspaces foreach -A run lint
yarn workspaces foreach -A run type-check
yarn i18n:check
yarn prompts:verify
npm test --workspaces -- --coverage --ci
npx nyc check-coverage --lines 95 --functions 95 --branches 90
npx snyk test --all-projects --severity-threshold=high

# ─── ORIGINAL ACCURACY GATES ───
npx ts-node -e "const {calculatePIT}=require('./packages/contracts/src');const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});if(Math.abs(r.taxLiability-632400)>1)process.exit(1);console.log('✅ PIT gate')"
npx ts-node -e "const {calculatePenalty}=require('./packages/contracts/src');const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});if(r.netPenalty!==375000)process.exit(1);console.log('✅ Penalty gate')"

# ─── NEW ACCURACY GATES FROM GAP ANALYSIS ───
npx ts-node -e "const {calculateCIT}=require('./packages/contracts/src');const r=calculateCIT({turnover:200_000_000,profit:50_000_000,devLevyApplies:false});if(r.citLiability!==15_000_000)process.exit(1);console.log('✅ CIT large company gate')"
npx ts-node -e "const {calculateCIT}=require('./packages/contracts/src');const r=calculateCIT({turnover:80_000_000,profit:20_000_000,devLevyApplies:false});if(r.citLiability!==0)process.exit(1);console.log('✅ CIT small company gate')"
npx ts-node -e "const {formatNGN}=require('./mobile/src/design-system/ngn');if(formatNGN(632_400)!=='₦632,400')process.exit(1);if(formatNGN(5_000_000,{compact:true})!=='₦5.0M')process.exit(1);console.log('✅ NGN format gate')"

# ─── NEW SECURITY GATES FROM GAP ANALYSIS ───
grep -q "handleSuspiciousReuse" backend/src/routes/v1/auth.ts && echo "✅ refresh token reuse detection" || echo "❌"
grep -q "totp/setup" backend/src/routes/v1/auth/totp.ts && echo "✅ TOTP enrollment" || echo "❌"
grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts && echo "✅ webhook idempotency" || echo "❌"
grep -q "standardHeaders.*true" backend/src/middleware/rateLimit.ts && echo "✅ rate limit headers" || echo "❌"
grep -q "SAFE_ROUTES" mobile/src/hooks/useDeepLink.ts && echo "✅ deep link allowlist" || echo "❌"
grep -q "global.__prisma" backend/src/lib/prisma.ts && echo "✅ Prisma pool singleton" || echo "❌"
test -f backend/src/workers/pdfWorker.ts && echo "✅ PDF worker" || echo "❌"
test -f backend/src/routes/v1/notifications.ts && echo "✅ push notification endpoint" || echo "❌"
grep -q "UserDevice" backend/prisma/schema.prisma && echo "✅ UserDevice model" || echo "❌"
grep -q "calculateCIT" packages/contracts/src/cit.ts && echo "✅ CIT tax math" || echo "❌"

# ─── INFRASTRUCTURE GATES ───
head -3 backend/src/app.ts | grep -q "validateEnv" && echo "✅ validateEnv first" || echo "❌"
awk '/^model AuditEvent/,/^}/' backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || echo "✅ AuditEvent immutable"
awk '/^model TaxHealthSnapshot/,/^}/' backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || echo "✅ TaxHealthSnapshot immutable"
grep -q 'opossum' backend/src/services/nrsService.ts && echo "✅ circuit breaker" || echo "❌"
docker build --target production -t taxbridge-api:validation . && echo "✅ Docker build" || echo "❌"

# ─── SMOKE TESTS (STAGING) ───
curl -sf ${STAGING_URL}/api/v2/monitoring/health | jq -e '.status == "healthy"'
```

---

# PART IV: UPDATED COMPLETION CRITERIA

The original 20 criteria are retained. The following 10 are added:

| # | Criterion |
|---|---|
| 21 | TOTP enrollment flow present: `POST /api/v1/auth/totp/setup`, `/verify`, `/disable`, `/backup` |
| 22 | Push notification registration: `POST /api/v1/notifications/register` + `UserDevice` model |
| 23 | Deep link whitelist enforced in `useDeepLink.ts` — `SAFE_ROUTES` array present |
| 24 | Webhook idempotency: Flutterwave handler returns `already_processed` on replay |
| 25 | CIT module: `calculateCIT()` in `packages/contracts/src/cit.ts` + accuracy gates passing |
| 26 | PDF receipts: `pdfWorker.ts` present; `TaxReturn.receiptUrl` populated after filing |
| 27 | Refresh token reuse: `handleSuspiciousReuse()` triggers audit event + push notification |
| 28 | Rate limit headers exposed: `standardHeaders: true` on all rate limiters |
| 29 | PgBouncer-compatible Prisma singleton: `global.__prisma` guard in `backend/src/lib/prisma.ts` |
| 30 | Lottie animations bundled: `confetti.json`, `success-checkmark.json`, `loading-spinner.json` present in `mobile/src/assets/animations/` and minified |

---

# PART V: UPDATED ABSOLUTE CONSTRAINTS

The existing C-01 through C-35 are retained without modification. The following additions apply:

| Code | Rule | Gate |
|---|---|---|
| C-36 | `useDeepLink()` route navigation only navigates to `SAFE_ROUTES` whitelist — no dynamic path injection | `grep -q "SAFE_ROUTES" mobile/src/hooks/useDeepLink.ts` |
| C-37 | Flutterwave webhook handler uses Redis idempotency guard before any DB writes — no exceptions | `grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts` |
| C-38 | TOTP backup codes are bcrypt-hashed before storage — never stored plaintext | `grep -q "bcrypt" backend/src/routes/v1/auth/totp.ts` |
| C-39 | All push notification bodies ≤ 150 characters — Expo hard limit | Lint rule or test |
| C-40 | PDF receipt generation is always async (BullMQ) — never blocks HTTP response | `grep -q "pdfQueue.add" backend/src/services/eventBus.ts` |
| C-41 | `calculateCIT()` is the only CIT computation path — no inline tax math | `grep -rn "0\.30.*profit\|profit.*0\.30" backend/src mobile/src` → 0 |
| C-42 | Lottie fallback component required — never crash if Lottie fails to load | `grep -q "onError" mobile/src/components/shared/ConfettiAnimation.tsx` |
| C-43 | Prisma client initialized via `backend/src/lib/prisma.ts` singleton — never `new PrismaClient()` in route handlers | `grep -rn "new PrismaClient" backend/src/routes` → 0 |

---

# PART VI: RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| NRS API downtime during launch | HIGH | CRITICAL | `DIGITAX_MOCK_MODE=true` + BullMQ retry queue |
| 2G performance regression on dashboard load | MEDIUM | HIGH | FlashList + React Query `offlineFirst` + skeleton 0px shift |
| TOTP lockout (SUPER_ADMIN loses device) | LOW | CRITICAL | 10 bcrypt-hashed backup codes |
| PDF generation queue backlog under load | MEDIUM | MEDIUM | BullMQ priority LOW; user gets "Receipt generating..." status while polling |
| Flutterwave webhook replay double-crediting | MEDIUM | CRITICAL | Redis idempotency guard (C-37) |
| PgBouncer connection exhaustion | MEDIUM | HIGH | `connection_limit=1` in DATABASE_URL for PgBouncer mode |
| CIT small-company misclassification | LOW | HIGH | Preflight check: warn if approaching ₦100M threshold |
| Expo push token expiry | MEDIUM | MEDIUM | Token refresh on next app open; fallback to SMS |

---

# APPENDIX A: FILE MANIFEST — NEW FILES ADDED BY ENHANCEMENT

| File | Type | Phase | Gap Resolved |
|---|---|---|---|
| `backend/src/routes/v1/auth/totp.ts` | NEW | P0 | GAP-03 |
| `backend/src/routes/v1/notifications.ts` | NEW | P0 | GAP-01 |
| `backend/src/lib/prisma.ts` | NEW | P0 | GAP-10 |
| `backend/src/workers/pdfWorker.ts` | NEW | P2 | GAP-15 |
| `packages/contracts/src/cit.ts` | NEW | P2 | GAP-05 |
| `mobile/src/hooks/usePushNotification.ts` | NEW | P0 | GAP-01 |
| `mobile/src/hooks/useDeepLink.ts` | NEW | P1 | GAP-07 |
| `mobile/src/screens/auth/TOTPSetupScreen.tsx` | NEW | P0 | GAP-03 |
| `mobile/src/screens/filings/CITFilingWizard.tsx` | NEW | P2 | GAP-05 |
| `mobile/src/components/shared/ConfettiAnimation.tsx` | NEW | P1 | GAP-14 |
| `mobile/src/assets/animations/confetti.json` | NEW | P1 | GAP-14 |
| `mobile/src/assets/animations/success-checkmark.json` | NEW | P1 | GAP-14 |
| `mobile/src/assets/animations/loading-spinner.json` | NEW | P1 | GAP-14 |
| `infra/k6/dashboard-load-test.js` | NEW | P3 | Performance |
| `infra/grafana/dashboard.json` | NEW | P3 | Observability |

| File | Type | Phase | Gap Resolved |
|---|---|---|---|
| `backend/src/routes/v1/auth.ts` | UPDATE | P0 | GAP-02 |
| `backend/src/routes/webhooks/flutterwave.ts` | UPDATE | P2 | GAP-06 |
| `backend/src/middleware/rateLimit.ts` | UPDATE | P1 | GAP-09 |
| `backend/src/services/compliancePreFlight.ts` | UPDATE | P2 | GAP-13 |
| `backend/src/services/eventBus.ts` | UPDATE | P2 | GAP-15 |
| `backend/src/validateEnv.ts` | UPDATE | P0 | GAP-15 |
| `backend/prisma/schema.prisma` | UPDATE | P0 | GAP-01 |
| `mobile/src/services/apiClient.ts` | UPDATE | P1 | GAP-11 |
| `mobile/app.json` | UPDATE | P1 | GAP-07 |
| `admin/src/middleware.ts` | UPDATE | P1 | GAP-12 |
| `packages/contracts/src/types.ts` | UPDATE | P0 | GAP-04 |
| `packages/contracts/src/index.ts` | UPDATE | P2 | GAP-05 |
| `.github/workflows/pipeline.yml` | UPDATE | P3 | All gaps |

---

# APPENDIX B: ENVIRONMENT VARIABLES — COMPLETE UPDATED MANIFEST

```bash
# ─── REQUIRED_ALWAYS (all environments) ───
DATABASE_URL            # postgresql://...?sslmode=require&pgbouncer=true&connection_limit=1
REDIS_URL               # rediss://...
JWT_SECRET              # RS256 PEM private key (openssl genrsa 4096)
JWT_REFRESH_SECRET      # random 64-char hex
NRS_API_KEY
PORT                    # 10000
NODE_ENV                # production | staging | development

# ─── REQUIRED_PRODUCTION ───
SENTRY_DSN
RENDER_EXTERNAL_URL
FLUTTERWAVE_SECRET
CBN_MPR                 # Current CBN MPR — update within 24h of CBN announcement
CORS_ORIGIN             # https://taxbridge.vercel.app,https://app.taxbridge.ng
DOCUMENT_VAULT_KMS_PROVIDER  # cloudflare
R2_ENDPOINT             # https://<account-id>.r2.cloudflarestorage.com     ← NEW
R2_BUCKET_NAME          # taxbridge-vault                                    ← NEW
R2_ACCESS_KEY_ID                                                             # ← NEW
R2_SECRET_ACCESS_KEY                                                         # ← NEW

# ─── OPTIONAL ───
DIGITAX_MOCK_MODE       # false (set true to bypass NRS circuit)
LOG_LEVEL               # info
LOG_FORMAT              # json
AFRICA_TALKING_API_KEY  # SMS fallback for push notifications
AFRICA_TALKING_USERNAME # sandbox | production

# ─── EAS SECRETS (CLI only — never in eas.json) ───
SENTRY_DSN
EXPO_PUSH_ACCESS_TOKEN   # ← NEW
EXPO_PUBLIC_PROJECT_ID   # ← NEW

# ─── GITHUB SECRETS ───
SMOKE_TEST_EMAIL
SMOKE_TEST_PASSWORD
RENDER_API_KEY
CBN_MPR
VERCEL_TOKEN
```

---

*TaxBridge V12 Enhancement Analysis — Complete*  
*Version: V12-ENHANCED | Date: 2026-03-02*  
*Build for: A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin.*
