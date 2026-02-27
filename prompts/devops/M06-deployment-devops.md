# MODULE M06 — DEPLOYMENT & DEVOPS
## TaxBridge AI Operating Context
**Token budget:** ~800 tokens | **Inject:** DevOps, CI/CD, build tasks

---

## PURPOSE
Reference for all deployment, CI/CD, monitoring, and infrastructure engineering.

## SCOPE
`.github/workflows/`, `infra/`, `scripts/`, EAS builds, Render, Vercel.

---

## DEPLOYMENT TARGETS

```
Backend:   Render.com (Node.js 20)
           URL: https://taxbridge-api-ker8.onrender.com
           Auto-deploy: push to master → Render webhook

Admin:     Vercel (Next.js 15)
           URL: https://taxbridge.vercel.app
           Auto-deploy: push to master → Vercel Git integration

Mobile:    EAS Build → Google Play Internal Testing → Production
           Config: mobile/eas.json (canonical — NOT root eas.json)
           OTA updates: eas update (for JS-only changes like i18n)
```

---

## CI PIPELINE (GitHub Actions)

```yaml
# .github/workflows/ci.yml — 4 jobs, all must pass for merge

jobs:
  backend-quality:
    - npm ci
    - npx tsc --noEmit                              # Zero TS errors
    - npm test -- --coverage                        # 423+ passing
    - grep -rn "FIRS" backend/src --include="*.ts"  # Must return 0
    - grep -rn "NRSt" mobile/src --include="*.json" # Must return 0
    - coverage check: tax engine ≥ 97%

  admin-quality:
    - npm ci
    - npm run build                                 # Next.js build must succeed

  mobile-quality:
    - npm ci
    - npx expo-doctor                               # Zero critical warnings
    - npx jest --coverage                           # All suites green
    - grep -rn "COMMON\." mobile/src/i18n --include="*.tsx" # Raw key check

  tax-compliance:
    - pwsh scripts/verify-tax-compliance.ps1        # NTA 2025 boundary tests
```

---

## ENVIRONMENT VARIABLES (All layers)

```
# Backend (Render)
DATABASE_URL            REDIS_URL               JWT_SECRET
JWT_REFRESH_SECRET      ENCRYPTION_KEY          ALLOWED_ORIGINS (never *)
PAYSTACK_SECRET_KEY     FLUTTERWAVE_SECRET_KEY  REMITA_API_KEY
DIGITAX_API_URL         DIGITAX_API_KEY         DIGITAX_MOCK_MODE (test only)
YOUVERIFY_API_KEY       GOOGLE_CLOUD_KEY_FILE   SENTRY_DSN
AFRICAS_TALKING_API_KEY INFOBIP_API_KEY         TERMII_API_KEY

# Mobile (EAS secrets)
EXPO_PUBLIC_API_URL     EXPO_PUBLIC_SENTRY_DSN  EXPO_PUBLIC_ENV

# Admin (Vercel)
NEXT_PUBLIC_API_URL     NEXT_PUBLIC_SENTRY_DSN  NEXTAUTH_SECRET
```

---

## MONITORING STACK

```
Prometheus metrics (GET /metrics):
  http_requests_total{method, route, status}
  http_request_duration_ms (histogram)
  queue_depth_gauge{queue}
  job_duration_ms (histogram)
  job_total{queue, outcome}
  nrs_submission_total{status}
  ocr_confidence_score (histogram)
  tax_health_score_distribution (histogram)

Sentry:
  Backend: @sentry/node — all uncaught exceptions + slow transactions
  Mobile:  @sentry/react-native — crashes + offline event queue
  Admin:   @sentry/nextjs

Alert thresholds (Prometheus → Alertmanager → Slack):
  Error rate:          > 1% sustained 5min
  NRS failures:        > 5% rate over 10min
  Queue depth:         > 100 for nrs-submission
  OCR confidence drop: avg < 0.70
  DLQ depth:           > 10 for any queue
```

---

## RENDER COLD-START HANDLING

```typescript
// Admin routes that must return 200 + fallback during warm-up:
// GET /api/admin/stats
// GET /api/admin/launch-metrics
// GET /api/admin/health/integrations

// Pattern:
try {
  const data = await getStats(prisma);
  return reply.send(data);
} catch {
  return reply.send(FALLBACK_STATS); // Never throw on admin health routes
}
```

---

## EAS BUILD CHECKLIST

```
□ mobile/eas.json is source of truth (not root eas.json)
□ compileSdkVersion: 36 in app.json
□ Cache key: v7-* (bump to v8-* if native deps change)
□ EXPO_NO_FINGERPRINT=1 in all EAS profiles
□ assetBundlePatterns includes vector-icons fonts
□ expo-doctor passes with zero critical warnings before build
□ For OTA-only changes (i18n, text): use eas update not full build
```

---

## PRE-DEPLOY SEQUENCE

```powershell
# Run before every production deploy:
pwsh scripts/validate-production-readiness.ps1
pwsh scripts/verify-tax-compliance.ps1

# Backend deploy (auto via Render on git push):
git push origin master

# Mobile build (manual):
cd mobile
eas build --platform android --profile production
eas build --platform ios --profile production

# OTA update (JS changes only, instant delivery):
eas update --branch production --message "fix: i18n offline keys"
```

---

## ROLLBACK TRIGGERS (Revert immediately if any occur)

```
□ Error rate > 5% sustained for 5 minutes
□ NRS submission failure rate > 20%
□ Any database connection failures
□ Any payment double-charge report
□ Any data breach indicator in audit logs
□ Tax calculation producing wrong results (P0 — immediate revert)
```

---

## INPUTS / OUTPUTS

```
Inputs:  Git pushes, EAS CLI commands, environment variable changes
Outputs: Render deploys, Vercel previews, EAS builds (AAB/IPA/APK), OTA updates,
         Prometheus dashboards, Sentry error streams, Slack alerts
```

## DEPENDENCIES

```
Internal: All TaxBridge packages (backend, mobile, admin, contracts)
External: GitHub Actions, Render.com, Vercel, EAS (Expo), Sentry, Prometheus,
          Alertmanager, Slack (alert routing)
```
