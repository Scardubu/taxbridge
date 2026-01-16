# TaxBridge Production Deployment - Quick Reference

**Target:** Production Launch  
**Status:** Ready to Deploy  
**Updated:** January 2025

---

## 🚦 Quick Status Check

Run these commands to verify readiness:

```powershell
# 1. Backend validation
cd backend
npm run build          # Should: 0 errors
npm test              # Should: 68 tests passing

# 2. Mobile validation
cd ../mobile
yarn tsc --noEmit     # Should: 0 errors
yarn test             # Should: 137 tests passing

# 3. Admin dashboard validation
cd ../admin-dashboard
npm run build         # Should: 14 routes, 0 warnings
```

---

## 🔑 Environment Variables Setup

### Backend (.env or platform secrets)

```bash
# Core
NODE_ENV=production
PORT=3000

# Database (e.g., Supabase Postgres)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.supabase.co:5432/taxbridge

# Redis (e.g., Upstash)
REDIS_URL=redis://default:[PASSWORD]@redis.upstash.io:6379

# Security (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=[64_char_hex_string]
ENCRYPTION_KEY=[64_char_hex_string]

# DigiTax (NRS Access Point Provider)
DIGITAX_API_KEY=[production_key]
DIGITAX_BASE_URL=https://api.digitax.ng

# Remita Payment Gateway
REMITA_MERCHANT_ID=[merchant_id]
REMITA_API_KEY=[production_key]
REMITA_SERVICE_TYPE_ID=[service_type_id]
REMITA_BASE_URL=https://remitademo.net/remita/exapp/api/v1/send/api

# Monitoring
SENTRY_DSN=[backend_sentry_dsn]
SENTRY_ENVIRONMENT=production
```

### Admin Dashboard (Vercel/Netlify)

```bash
NEXT_PUBLIC_APP_URL=https://admin.taxbridge.ng
BACKEND_URL=https://api.taxbridge.ng
ADMIN_API_KEY=[admin_key]
NEXT_PUBLIC_SENTRY_DSN=[admin_sentry_dsn]
NEXT_PUBLIC_MIXPANEL_TOKEN=[production_token]
```

### Mobile (EAS Secrets)

API base URL is configured in-app (Settings → API URL). Defaults:
- Development: Android emulator -> http://10.0.2.2:3000
- Production: https://api.taxbridge.ng

Optional observability tokens can still be provided via EAS secrets (example):

```json
{
  "EXPO_PUBLIC_SENTRY_DSN": "[mobile_sentry_dsn]",
  "EXPO_PUBLIC_MIXPANEL_TOKEN": "[production_token]"
}
```

---

## 🚀 Deployment Commands

### 1. Backend (Render/Railway/Fly.io)

**Option A: Render**
```bash
# Connect repo to Render dashboard
# Set environment variables in Render UI
# Render auto-deploys on git push to main

# Manual trigger:
git push origin main

# Run migrations via Render shell:
npm run migrate:prod
```

**Option B: Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link
railway login
railway link

# Deploy
railway up

# Run migrations
railway run npm run migrate:prod
```

**Option C: Fly.io**
```bash
# Install flyctl
# https://fly.io/docs/hands-on/install-flyctl/

# Deploy
cd backend
fly launch --name taxbridge-api
fly deploy

# Set secrets
fly secrets set DATABASE_URL="..." REDIS_URL="..." JWT_SECRET="..."

# Run migrations
fly ssh console
npm run migrate:prod
```

### 2. Admin Dashboard (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
cd admin-dashboard
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://admin.taxbridge.ng
vercel env add BACKEND_URL production
# Enter: https://api.taxbridge.ng
vercel env add ADMIN_API_KEY production
# Enter: <admin key>

# Deploy
vercel --prod
```

### 3. Mobile App (EAS/Expo)

```bash
cd mobile

# Build for Android (Google Play)
eas build --platform android --profile production
# Output: .aab file (app bundle)

# Build for iOS (App Store)
eas build --platform ios --profile production
# Output: .ipa file

# Submit to Google Play
eas submit --platform android --latest

# Submit to Apple App Store
eas submit --platform ios --latest
```

---

## 🔍 Post-Deployment Verification

### Health Checks

```powershell
# 1. Backend API
curl https://api.taxbridge.ng/health
# Expected: {"status":"ok","timestamp":"2025-01-XX..."}

# 2. Admin Dashboard
curl -I https://admin.taxbridge.ng
# Expected: HTTP/2 200

# 3. SSL Certificate
curl -I https://api.taxbridge.ng
# Expected: Valid SSL (no warnings)

# 4. Favicon Multi-Size Check
curl -I https://admin.taxbridge.ng/favicon.ico
# Expected: 200 OK

# Verify in browser DevTools:
# - Network tab: favicon loads (16×16, 32×32, 48×48)
# - Console: No 404 errors for assets
```

### Functional Smoke Tests

1. **User Registration (Mobile)**
   - Open app → "Create Account"
   - Fill form → Submit
   - Check: User created in database

2. **Invoice Creation (Offline)**
   - Create invoice without internet
   - Check: Saved to local SQLite
   - Toggle internet → Check: Auto-syncs to backend

3. **DigiTax Submission (Sandbox First)**
   - Create invoice → Submit to NRS
   - Check: CSID/IRN generated
   - Check: QR code displayed

4. **Remita Payment**
   - Generate invoice → "Pay with Remita"
   - Check: RRR generated
   - Complete payment → Check: Webhook confirms

5. **Admin Dashboard**
   - Login at https://admin.taxbridge.ng
   - Check: Metrics cards display
   - Check: Brand logo visible
   - Check: Favicon in browser tab

---

## 🛠️ Troubleshooting

### Issue: "Module not found" in Admin Dashboard

**Symptom:** Build fails with `Can't resolve '../../mobile/assets/*'`

**Solution:**
```bash
cd admin-dashboard
rm -rf .next
npm run build
```

**Prevention:** Ensure `next.config.ts` has:
```typescript
experimental: { externalDir: true },
turbopack: { root: path.resolve(__dirname, "..") }
```

### Issue: Mobile App Shows "Network Error"

**Symptom:** API calls fail with "Network request failed"

**Solution:**
1. Check `EXPO_PUBLIC_API_URL` in EAS build profile
2. Verify backend is running: `curl https://api.taxbridge.ng/health`
3. Check Expo Go vs Production build (Expo Go uses dev profile)

### Issue: Favicon Not Loading

**Symptom:** Browser shows generic icon instead of TaxBridge logo

**Solution:**
1. Check `admin-dashboard/app/layout.tsx` imports:
   ```typescript
   import favicon48 from "../../mobile/assets/favicon.png";
   import favicon32 from "../../mobile/assets/favicon 32x32.png";
   import favicon16 from "../../mobile/assets/favicon 16x16.png";
   ```
2. Clear browser cache (Ctrl+Shift+Del)
3. Verify in DevTools Network tab: All 3 sizes load

### Issue: Database Migration Fails

**Symptom:** `npm run migrate:prod` errors

**Solution:**
1. Check `DATABASE_URL` env var is set
2. Verify Postgres connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
3. Run migrations manually:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

---

## 📊 Monitoring Dashboard URLs

After deployment, bookmark these:

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | https://api.taxbridge.ng/health | Health check |
| Admin Dashboard | https://admin.taxbridge.ng | Admin console |
| Sentry (Backend) | https://sentry.io/organizations/[org]/projects/taxbridge-backend/ | Error tracking |
| Sentry (Mobile) | https://sentry.io/organizations/[org]/projects/taxbridge-mobile/ | Crash reports |
| Sentry (Admin) | https://sentry.io/organizations/[org]/projects/taxbridge-admin/ | Frontend errors |
| Uptime Monitor | https://uptimerobot.com/dashboard | Uptime stats |
| Render Dashboard | https://dashboard.render.com | Backend logs |
| Vercel Dashboard | https://vercel.com/[team]/taxbridge-admin | Admin deployment logs |
| EAS Dashboard | https://expo.dev/accounts/[account]/projects/taxbridge | Mobile builds |

---

## 🎯 Launch Day Checklist

- [ ] **T-24h:** Announce maintenance window to beta users
- [ ] **T-12h:** Final staging validation
- [ ] **T-6h:** Double-check all production secrets
- [ ] **T-2h:** Deploy backend → Run migrations
- [ ] **T-1h:** Deploy admin dashboard
- [ ] **T-30m:** Submit mobile apps to stores
- [ ] **T-0:** Announce launch on social media
- [ ] **T+1h:** Monitor Sentry for errors
- [ ] **T+6h:** Check user registration metrics
- [ ] **T+24h:** Post-launch review meeting

---

## 📞 Emergency Rollback

If critical issue detected:

```bash
# 1. Backend rollback
cd backend
git revert HEAD
git push origin main
# Render/Railway auto-deploys previous version

# 2. Admin dashboard rollback
cd admin-dashboard
vercel rollback
# Or via Vercel dashboard: Deployments → Previous → "Promote to Production"

# 3. Mobile app
# Cannot rollback instantly (App Store review required)
# Workaround: Release hotfix build with expedited review

# 4. Database rollback
cd backend
npx prisma migrate resolve --rolled-back [migration_name]
```

---

## ✅ Success Metrics (Week 1)

Track these KPIs:

- **User Registrations:** Target 100+ in first week
- **Invoice Creation:** Target 500+ invoices
- **DigiTax Success Rate:** > 95%
- **API Uptime:** > 99.9%
- **Mobile Crash Rate:** < 0.5%
- **Admin Dashboard Load Time:** < 2s (p95)

---

**Last Updated:** January 2025  
**Document Owner:** Engineering Team  
**Review Frequency:** Weekly (first month), then monthly
