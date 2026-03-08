# TaxBridge Admin Architecture Decision Record

## Status: DECIDED (March 2026)

## Context

The TaxBridge monorepo contains two admin application directories:

- **`admin/`** — A Next.js 15 application (`@taxbridge/admin`)
- **`admin-dashboard/`** — A Next.js 16 application with richer UI dependencies

Both applications were being built in CI, creating ambiguity about which surface is authoritative for production.

## Decision

**`admin-dashboard/` is the canonical production admin surface.**

### Evidence

1. **Vercel Deployment**: `vercel.json` explicitly deploys `admin-dashboard`:
   ```json
   {
     "buildCommand": "cd admin-dashboard && npm run build",
     "outputDirectory": "admin-dashboard/.next"
   }
   ```

2. **Production Workflow**: `.github/workflows/deploy-production.yml` has a dedicated `deploy-admin` job that:
   - Uses `admin-dashboard` as working directory
   - Runs `vercel --prod` for deployment
   - References `ADMIN_URL: https://taxbridge.vercel.app`

3. **Feature Completeness**: `admin-dashboard` has:
   - Full SWR-based data fetching
   - Comprehensive UI component library (shadcn/ui, Radix)
   - Internationalization support
   - WCAG 2.2 AA compliant charts
   - Production-ready fallback handling

4. **Root Workspace Scripts**: Updated to target `admin-dashboard`:
   ```json
   {
     "type-check:admin": "npm run type-check --workspace=admin-dashboard",
     "build": "... && npm run build --workspace=admin-dashboard"
   }
   ```

## Consequences

### `admin-dashboard/` (Canonical)
- All production admin features should be implemented here
- API routes use consistent patterns via `lib/backend.ts` and `lib/backendHealth.ts`
- Deployed to Vercel at `https://taxbridge.vercel.app`

### `admin/` (Non-Canonical)
- Retained for potential future use or experimental features
- Still built in CI for type-checking validation
- **NOT deployed to production**
- Should not receive feature parity updates
- Should not gate canonical production release readiness when `admin-dashboard/` is healthy

## API Access Patterns

The canonical admin surface uses two access patterns:

### 1. Authenticated Admin API (`lib/backend.ts`)
For endpoints requiring `X-Admin-API-Key`:
```typescript
import { requestBackend } from '@/lib/backend';
const data = await requestBackend('/users');
```

### 2. Public Health Endpoints (`lib/backendHealth.ts`)
For unauthenticated health checks:
```typescript
import { fetchHealthEndpoint } from '@/lib/backendHealth';
const { data, ok } = await fetchHealthEndpoint('/health/integrations');
```

## File Structure

```
admin-dashboard/
├── app/
│   ├── api/admin/           # Server-side API proxies
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── compliance/
│   │   ├── health/
│   │   │   ├── duplo/
│   │   │   ├── integrations/
│   │   │   ├── queues/
│   │   │   └── remita/
│   │   ├── invoices/
│   │   ├── launch-metrics/
│   │   ├── stats/
│   │   └── users/
│   ├── compliance/          # Compliance pages
│   └── dashboard/           # Dashboard pages
├── components/              # Shared UI components
├── lib/
│   ├── backend.ts           # Authenticated admin API client
│   ├── backendHealth.ts     # Public health endpoint client
│   ├── adminApiFallback.ts  # Fallback response utilities
│   └── fetcher.ts           # SWR fetcher
└── hooks/                   # React hooks
```

## Migration Notes

If consolidating to a single admin surface in the future:
1. Archive `admin/` directory
2. Remove `admin` from root `workspaces` in `package.json`
3. Update CI workflows to remove `admin/` jobs
4. Redirect any `admin/` references to `admin-dashboard/`

---

*Last updated: March 8, 2026*
