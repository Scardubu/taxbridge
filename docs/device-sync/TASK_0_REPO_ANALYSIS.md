# Task 0 — Repo Analysis & Safe Plan

## Git status
- Branch: feature/device-sync/3-backend-routes
- Working tree: clean
- Default branch (origin/HEAD): master

## Repo map (top-level)
- Folders: admin-dashboard, backend, mobile, ml, infra, packages, docs, assets, public
- Monorepo: Yarn workspaces in root package.json

## Existing Prisma models relevant to device sync
File: backend/prisma/schema.prisma

### Device
Fields: id, userId, deviceId, platform, appVersion, osVersion, locale, lastSeenAt, lastHeartbeat, network, batteryPct, active, createdAt, updatedAt

### SyncJob
Fields: id, deviceId, userId, invoiceId, clientId, entity, action, operation, clientVersion, payload, status, result, attempts, lastError, syncedAt, startedAt, completedAt, createdAt, updatedAt

### Conflict
Fields: id, invoiceId, userId, deviceId, localVersion, serverVersion, localData, serverData, status, resolution, resolvedBy, resolvedAt, createdAt, updatedAt

### Other related models already present
- AuditLog, InvoiceVersion, OCRJob, AdminAction
- Invoice includes version Int @default(1)

## Package managers & scripts
- Root: Yarn workspaces, Node 20.x
- Backend: Jest tests; scripts include dev, build, start, worker, prisma:migrate:deploy
- Admin dashboard: Next.js; Jest tests; scripts dev/build/start
- Mobile: Expo; Jest tests; scripts start/android/ios

## Testing infrastructure
- Jest: backend, admin-dashboard, mobile
- Load/Perf: k6 scripts in backend

## CI/CD
GitHub Actions workflows in .github/workflows:
- ci.yml
- backend-ci.yml
- test-automation.yml
- deploy-production.yml

## JWT/Auth pattern detection
- JWT secrets required in backend/src/server.ts
- JWT handling in backend/src/services/auth.ts

---

## Plan for Task 1 (contracts) — proposed changes
Branch to create from master: feature/device-sync/1-contracts

Planned files:
- packages/contracts/src/sync.ts
- packages/contracts/src/index.ts (export sync schemas)
- packages/contracts/package.json (if missing)
- packages/contracts/tsconfig.json (if missing)
- packages/contracts/__tests__/sync.test.ts (or __tests__/sync.spec.ts)

Notes:
- Reuse existing Zod dependency from backend, ensure no duplicate schema definitions.
- Keep FEATURE_DEVICE_SYNC default false in .env.example (already present in backend/.env.example).
