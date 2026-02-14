# Device Sync Rollout Runbook

## Overview

This document describes how to enable, monitor, and roll back the queue-based device sync feature introduced by the `feature/device-sync/merge-safe-impl` branch.

---

## Feature Flags

| Flag | Where | Default | Purpose |
|------|-------|---------|---------|
| `FEATURE_DEVICE_SYNC` | Backend `.env` | `false` | Gates all `/api/v1/device/*` and `/api/v1/sync/*` routes |
| `EXPO_PUBLIC_FEATURE_DEVICE_SYNC` | Mobile `.env` | `false` | Switches SyncContext from legacy sync to queue-based sync |

Both flags must be `true` for the full device-sync flow to activate. When either is `false`, the system falls back to the legacy `syncPendingInvoices()` path with no behavior change.

---

## Pre-Rollout Checklist

1. **Database migrations applied** — Ensure the `devices`, `sync_jobs`, `conflicts`, `invoice_versions` tables exist (migrations `20260124141535_add_device_sync` and `20260125221538_fix_device_sync_schema`).
2. **Redis available** — The device-sync BullMQ queue (`device-sync`) requires Redis. Verify `REDIS_URL` is set and reachable.
3. **Contracts built** — Run `yarn workspace @taxbridge/contracts build` to compile the updated sync schemas.
4. **Backend worker running** — The `device-sync` worker must be active: `yarn workspace taxbridge-backend worker` or verify it starts with the main server.
5. **Tests passing** — Run backend tests: `cd backend && node ../node_modules/jest/bin/jest.js --forceExit --selectProjects unit`

---

## Rollout Stages

### Stage 1: Internal / Staging

```bash
# Backend .env
FEATURE_DEVICE_SYNC=true

# Mobile .env (Expo)
EXPO_PUBLIC_FEATURE_DEVICE_SYNC=true
```

- Deploy to staging environment
- Verify: heartbeat → push → worker processing → pull cycle
- Check for conflicts in admin dashboard (`/api/admin/devices`)
- Monitor Redis queue depth and worker processing rate

### Stage 2: Limited Production Cohort

- Enable `FEATURE_DEVICE_SYNC=true` on production backend
- Enable `EXPO_PUBLIC_FEATURE_DEVICE_SYNC=true` only in a staged OTA update (Expo Updates channel)
- Monitor for 48 hours:
  - Sync job success rate > 95%
  - Conflict rate < 5%
  - No increase in error rates on existing endpoints
  - Mobile crash-free rate unchanged

### Stage 3: Full Production

- Push OTA update to all users with device sync enabled
- Monitor for 7 days before considering stable

---

## Key Metrics to Monitor

| Metric | Source | Threshold |
|--------|--------|-----------|
| Sync job success rate | `sync_jobs` table: `status = 'synced'` / total | > 95% |
| Conflict rate | `conflicts` table: unresolved count | < 5% of pushes |
| Queue depth | Redis `device-sync` queue length | < 100 sustained |
| Worker processing latency | BullMQ job completion time | < 5s p95 |
| Mobile sync errors | Sentry / app logs | No new error classes |
| Heartbeat success rate | `audit_logs` where `action = 'DEVICE_HEARTBEAT'` | > 99% |

### Admin API Endpoints for Monitoring

```
GET /api/admin/devices              — List all registered devices
GET /api/admin/sync/pending         — View pending sync jobs
POST /api/admin/device/force-sync   — Force sync for a specific device
GET /api/admin/sync/audit           — Audit log for sync operations
GET /api/admin/sync/conflicts       — List all unresolved conflicts
```

---

## Rollback Procedure

### Quick Rollback (No Data Loss)

1. Set `FEATURE_DEVICE_SYNC=false` in backend `.env` and restart
2. Push mobile OTA with `EXPO_PUBLIC_FEATURE_DEVICE_SYNC=false`
3. All sync routes return 404; mobile falls back to legacy `syncPendingInvoices()`
4. Existing synced data is preserved; pending queue items remain in local SQLite

### Full Rollback (Schema Removal)

Only if needed to completely remove device sync tables:

```bash
psql -d your_database < backend/scripts/rollback-device-sync.sql
```

**Warning:** This deletes all device registrations, sync jobs, and conflict records.

---

## Troubleshooting

### Queue items stuck in pending

1. Check Redis connectivity: `redis-cli -u $REDIS_URL ping`
2. Verify worker is running: check for `device-sync` worker logs
3. Force-process via admin: `POST /api/admin/device/force-sync`

### High conflict rate

1. Check if multiple devices are creating the same invoice IDs
2. Review conflict list: `GET /api/admin/sync/conflicts`
3. Resolve conflicts: `POST /api/v1/sync/conflicts/resolve`

### Mobile sync not triggering

1. Verify feature flag: `EXPO_PUBLIC_FEATURE_DEVICE_SYNC=true`
2. Check device registration state in DeviceContext
3. Ensure user has granted `device_tracking` consent
4. Verify auth token is valid

---

## Architecture Summary

```
Mobile App                          Backend
┌───────────────────┐              ┌──────────────────────┐
│ SyncContext        │              │ sync.ts routes       │
│  ├─ doSyncWithBackoff()          │  ├─ POST /heartbeat  │
│  │  └─ processQueueSync()        │  ├─ POST /push       │
│  │     ├─ sendHeartbeat() ──────►│  │  └─ idempotency   │
│  │     ├─ pushBatch() ──────────►│  │     guard          │
│  │     │  └─ syncPush()          │  ├─ GET /pull        │
│  │     └─ syncPull() ──────────►│  └─ GET /conflicts   │
│  │                               │                      │
│  ├─ syncQueue.ts                 │ syncWorker.ts        │
│  │  ├─ enqueue                   │  └─ processSyncJob() │
│  │  ├─ getPending                │                      │
│  │  ├─ update                    │ BullMQ queue         │
│  │  └─ remove                    │  └─ device-sync      │
│  │                               │                      │
│  └─ DeviceContext                │ Prisma models        │
│     ├─ heartbeat interval        │  ├─ Device           │
│     └─ device state FSM          │  ├─ SyncJob          │
│                                  │  └─ Conflict         │
└───────────────────┘              └──────────────────────┘
```

Feature flags gate both ends independently:
- Backend: `FEATURE_DEVICE_SYNC` → routes return 404 when false
- Mobile: `EXPO_PUBLIC_FEATURE_DEVICE_SYNC` → falls back to legacy sync when false
