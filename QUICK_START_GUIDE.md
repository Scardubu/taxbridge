# TaxBridge - Quick Start Guide (Team Onboarding)

**Last Updated:** January 14, 2026  
**For:** New developers, contributors, and stakeholders

---

## 🎯 What is TaxBridge?

**Offline-first tax compliance platform for Nigerian SMEs**

- 📱 React Native mobile app (iOS + Android)
- 🔧 Node.js + Fastify backend
- 📊 Next.js admin dashboard
- 🤖 AI-enhanced growth automation
- 🇳🇬 Nigeria Tax Act 2025 compliant

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

```powershell
# Check versions
node -v    # Should be v18+
yarn -v    # Should be v1.22+
git --version
```

### Clone & Install

```powershell
# Clone repository
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Install all dependencies (use Yarn for workspaces)
yarn install
```
```

### Run Mobile App (Development)

```powershell
# From root directory
cd taxbridge

# Start Metro bundler (offline mode recommended for local dev)
yarn workspace mobile start

# Or run from mobile directory
cd mobile && yarn start

# In another terminal, run on device
# Android
yarn workspace mobile android

# iOS (macOS only)
yarn workspace mobile ios

# Run tests
yarn workspace mobile test
```

**Expected:** 136 tests passing, app loads on simulator/device.

---

## 📁 Repository Structure

```
taxbridge/
├── mobile/              # React Native app (Expo)
│   ├── src/
│   │   ├── screens/     # OnboardingScreen, HomeScreen, etc.
│   │   ├── components/  # Reusable UI (AnimatedButton, etc.)
│   │   ├── services/    # API, database, sync
│   │   └── utils/       # taxCalculator, validation
│   ├── __tests__/       # 136 tests (7 suites)
│   └── app.json         # Expo config
│
├── backend/             # Node.js + Fastify API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # growth.ts (campaigns)
│   │   ├── integrations/ # DigiTax, Remita, SMS
│   │   ├── lib/         # cache.ts, performance.ts, logger.ts
│   │   └── queue/       # BullMQ workers
│   ├── prisma/          # Database schema
│   └── tsconfig.json
│
├── admin-dashboard/     # Next.js admin UI
│   ├── app/             # Next.js 15 app router
│   ├── components/      # LaunchMetricsWidget, etc.
│   └── lib/             # API fetchers
│
├── docs/                # Documentation
│   ├── PRD.md
│   ├── launch-plan.md
│   ├── launch-day-runbook.md
│   ├── community-strategy.md
│   └── ML_CHURN_IMPLEMENTATION.md
│
├── infra/               # Deployment scripts
│   └── scripts/
│       └── pre-launch-check.sh
│
└── deploy-production.ps1  # Deployment automation
```

---

## 🧪 Running Tests

### Mobile (Jest + Expo)

```powershell
cd mobile
yarn test

# Watch mode
yarn test --watch

# Coverage
yarn test --coverage

# Or from root
yarn workspace mobile test
```

**Expected Output:**
```
Test Suites: 7 passed, 7 total
Tests:       136 passed, 136 total
Time:        ~18s
```

### Backend (Jest + Supertest)

```powershell
cd backend
yarn test

# Integration tests only
yarn test --testPathPattern=integration

# Or from root
yarn workspace @taxbridge/backend test
```

### Admin Dashboard (Jest + React Testing Library)

```powershell
cd admin-dashboard
yarn test

# Or from root
yarn workspace admin-dashboard test
```

---

## 🔑 Environment Setup

### Development (.env.local)

```bash
# Mobile (mobile/.env.local)
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_ENV=development

# Backend (backend/.env)
DATABASE_URL=postgresql://localhost:5432/taxbridge_dev
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000

# Admin Dashboard (admin-dashboard/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_API_KEY=dev_admin_key
```

**Important:** Never commit `.env` files! Use `.env.example` as templates.

---

## 🛠️ Common Commands

### Development Workflow

```powershell
# Start backend API
cd backend
yarn dev  # Runs on http://localhost:3000

# Or from root
yarn workspace @taxbridge/backend dev

# Start admin dashboard
cd admin-dashboard
yarn dev  # Runs on http://localhost:3001

# Start mobile app
cd mobile
yarn start    # Opens Expo dev server

# Or from root
yarn workspace mobile start
```

### Database Management

```powershell
cd backend

# Create migration
npm run migrate:dev -- --name add_new_table

# Apply migrations
npm run migrate:deploy

# Reset database (dev only!)
npm run migrate:reset

# Open Prisma Studio
npm run prisma:studio
```

### Build Production

```powershell
# Backend
cd backend
npm run build  # Compiles TypeScript to dist/

# Admin Dashboard
cd admin-dashboard
npm run build  # Creates .next/ production bundle

# Mobile App
cd mobile
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## 📊 Key Features to Understand

### 1. Offline-First Architecture

**Mobile App (SQLite):**
- Invoices stored locally (even without internet)
- Auto-sync when online (SyncContext)
- Conflict resolution (last-write-wins)

**Sync Flow:**
```
User creates invoice → SQLite (local) → Mark as pending
→ Network available → Sync to backend → Mark as synced
→ Get CSID/IRN from DigiTax → Update local record
```

### 2. Tax Onboarding System (6 Steps)

**Flow:**
1. **Profile Assessment:** Income source, business type
2. **PIT Tutorial:** Personal Income Tax calculator
3. **VAT/CIT Awareness:** Threshold checks
4. **FIRS Demo:** Mock e-invoicing simulation
5. **Gamification:** Optional achievements
6. **Community:** Referral codes, social features

**Key Files:**
- `mobile/src/screens/OnboardingScreen.tsx`
- `mobile/src/components/onboarding/*.tsx` (6 step components)
- `mobile/src/contexts/OnboardingContext.tsx`

### 3. Growth Automation (BullMQ)

**Campaign Types:**
- Welcome (4 touchpoints: Day 0, 3, 7, 14)
- Reactivation (inactive 7+ days)
- Referral reminders
- Premium upgrade prompts
- NPS surveys (30-day cohort)
- Churn prediction (heuristic model)

**Key File:**
- `backend/src/services/growth.ts` (519 lines)

**Queue Workers:**
- Email queue: `bull:email-campaign`
- SMS queue: `bull:sms-campaign`

### 4. Launch Metrics Dashboard

**Real-Time Tracking:**
- **NRR:** Net Revenue Retention (≥106% target)
- **GRR:** Gross Revenue Retention (≥90% target)
- **MRR:** Monthly Recurring Revenue
- **Paid Users:** Active premium subscribers

**Status Badges:**
- 🟢 Healthy: NRR ≥110%, GRR ≥95%
- 🟡 Watch: NRR 100-109%, GRR 85-94%
- 🔴 Risk: NRR <100%, GRR <85%

**Key Files:**
- `admin-dashboard/components/LaunchMetricsWidget.tsx` (236 lines)
- `backend/src/routes/admin.ts` (`/api/admin/launch-metrics` endpoint)

---

## 🐛 Common Issues & Solutions

### Issue 1: TensorFlow.js Installation Failed

**Error:**
```
npm ERR! gyp ERR! build error
npm ERR! node-gyp rebuild
```

**Solution:**
```powershell
# Option A: Use heuristic model (already implemented)
# No action needed - app works without TensorFlow.js

# Option B: Install Visual Studio 2022 (C++ build tools)
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"

# Option C: Use Docker (Linux environment)
docker-compose up backend
```

**Status:** ✅ **MITIGATED** - Heuristic churn model is production-ready (70% accuracy).

---

### Issue 2: libxmljs Installation Failed (Windows)

**Error:**
```
error C:\...\node_modules\libxmljs: Command failed.
node-pre-gyp ERR! build error
```

**Root Cause:**
`libxmljs` requires Visual Studio C++ build tools on Windows.

**Solution:**
```powershell
# Already fixed! Project now uses fast-xml-parser (pure JavaScript)
# No action needed - UBL validation works without native dependencies

# If you see this error:
# 1. Clear Yarn cache: yarn cache clean
# 2. Remove node_modules: rm -r node_modules
# 3. Reinstall: yarn install
```

**Migration Details:**
- **Old:** `libxmljs` (C++ native module, XSD validation)
- **New:** `fast-xml-parser` (Pure JS, structural validation)
- **Impact:** Basic UBL structure validation (DigiTax APP provides full XSD validation)
- **File:** `backend/src/lib/ubl/validate.ts`

**Status:** ✅ **RESOLVED** - No native dependencies required.

---

### Issue 3: Database Connection Failed

**Error:**
```
Error: P1001: Can't reach database server at `localhost:5432`
```

**Solution:**
```powershell
# Check PostgreSQL is running
psql --version

# Start PostgreSQL (Windows)
# Open Services → PostgreSQL → Start

# Or use Supabase (cloud)
# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/dbname
```

---

### Issue 3: Mobile App Won't Load

**Error:**
```
Unable to resolve module `@react-native-async-storage/async-storage`
```

**Solution:**
```powershell
cd mobile

# Clear cache
npm start -- --clear

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild iOS pods (macOS)
cd ios && pod install && cd ..
```

---

### Issue 5: Tests Failing

**Error:**
```
FAIL __tests__/OnboardingSystem.integration.test.tsx
```

**Solution:**
```powershell
# Update Jest config (mobile/jest.config.js)
# Ensure jest-expo preset is used

# Clear Jest cache
yarn test --clearCache

# Run tests in band (no parallel)
yarn test --runInBand
```

**Expected:** All 136 tests should pass.

---

## 📚 Essential Reading (Priority Order)

### For Developers

1. **FINAL_PRODUCTION_READINESS_SUMMARY.md** ← **START HERE**
   - Overall status, test results, immediate next steps

2. **mobile/README.md**
   - Mobile app architecture, features, testing

3. **backend/README.md**
   - API endpoints, integrations, queue workers

4. **docs/PRD.md**
   - Product requirements, user flows, compliance

### For DevOps/Ops

1. **STAGING_DEPLOYMENT_GUIDE.md**
   - Step-by-step deployment to Render/Vercel/EAS

2. **PRODUCTION_READINESS_CHECKLIST.md**
   - 180+ item checklist before launch

3. **infra/scripts/pre-launch-check.sh**
   - Automated health checks (50+ validations)

### For Product/Growth

1. **docs/launch-plan.md**
   - Phase 1-4 rollout strategy, metrics

2. **docs/community-strategy.md**
   - Ambassador program, partnerships (SMEDAN)

3. **docs/ML_CHURN_IMPLEMENTATION.md**
   - Churn prediction (heuristic + ML roadmap)

### For Stakeholders

1. **V5_LAUNCH_IMPLEMENTATION_COMPLETE.md**
   - Feature summary, business impact

2. **PRODUCTION_LAUNCH_SUMMARY.md**
   - War room reference, financial guardrails

---

## 🎯 Success Metrics (Week 1)

| Metric | Target | How to Check |
|--------|--------|--------------|
| Mobile tests | 136 passing | `cd mobile && npm test` |
| Backend uptime | 99%+ | https://api-staging.taxbridge.ng/health |
| Invoices created | 80+ | Mixpanel → Events → "invoice_created" |
| NRS submissions | 95%+ | Admin Dashboard → Metrics |
| Pilot user NPS | ≥7 | Google Form responses |

---

## 🔐 Security Best Practices

### Never Commit:

```
.env
.env.local
.env.staging
.env.production
*.pem
*.p12
google-play-service-account.json
```

### Always:

- Use `.env.example` templates
- Store secrets in 1Password vault
- Rotate keys every 90 days
- Enable 2FA on all services
- Review code before committing

### Secret Management:

```powershell
# Retrieve from 1Password CLI
op read "op://TaxBridge/Production/DATABASE_URL"

# Or use team Slack pinned message for staging
```

---

## 🆘 Getting Help

### Slack Channels

- `#taxbridge-dev` - Development questions
- `#taxbridge-launch` - Launch coordination
- `#taxbridge-alerts` - Monitoring alerts
- `#taxbridge-incidents` - P0/P1 issues

### Documentation

- **This File:** Quick start guide
- **README.md:** High-level overview
- **docs/** folder: Detailed guides

### Contacts

| Question | Ask |
|----------|-----|
| Mobile app issues | @mobile-lead |
| Backend/API questions | @backend-lead |
| Deployment help | @devops-lead |
| Product decisions | @product-lead |
| Community/ambassadors | @community-lead |

---

## ✅ Final Checklist (New Team Member)

- [ ] Repository cloned
- [ ] Dependencies installed (mobile, backend, admin)
- [ ] .env files configured (from .env.example)
- [ ] Mobile tests passing (136 tests)
- [ ] Backend running locally (http://localhost:3000)
- [ ] Admin dashboard running (http://localhost:3001)
- [ ] Read FINAL_PRODUCTION_READINESS_SUMMARY.md
- [ ] Read mobile/README.md
- [ ] Joined Slack channels
- [ ] Added to 1Password vault

---

## 🚀 Ready to Contribute!

**You're all set!** 

Next steps:
1. Pick a task from Jira/GitHub Issues
2. Create feature branch: `git checkout -b feat/your-feature`
3. Make changes, write tests
4. Run tests: `npm test`
5. Commit: `git commit -m "feat: your feature"`
6. Push: `git push origin feat/your-feature`
7. Open PR on GitHub

**Welcome to TaxBridge!** 🎉

---

**Mission:** *"Compliance without fear. Technology without exclusion."*
