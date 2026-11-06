# TaxBridge Admin Architecture

## Canonical application

- **Canonical web application:** `admin-dashboard/`.
- **Framework:** Next.js 16.1.1 / React 19.1.0 (App Router).
- **Vercel project root:** `admin-dashboard`.
- **Package runtime:** Node `26.x` for the current Vercel build environment.
- **Build:** `npm ci`, then `npm run build`.
- **Output:** `.next`.
- **API:** Fastify 5.x service on Render; browser code must use authenticated same-origin server routes for privileged operations.

The separate legacy `admin/` directory is not the canonical deployment target. It must not receive production traffic unless it is explicitly re-approved as a separately owned application with an independent security review.

## Product boundary

The current web application is an internal operations and administrative console. This codebase does not currently establish a complete customer-facing SME web portal. Do not claim that SME registration, onboarding, invoice/receipt management, tax filing, and account-security journeys are available on web merely because corresponding mobile or backend modules exist.

## Security & Authentication boundary

The production admin proxy enforces multi-layered defense-in-depth:

1. **Strict Same-Origin Enforcement:**
   All browser session mutations and proxy actions validate the incoming `Origin` and `Host` headers (`lib/auth-origin.ts`), failing closed against cross-origin attacks.
2. **Double-Submit CSRF Protection:**
   Mutating API proxy actions require a valid `tb_csrf` cookie matching the `x-csrf-token` header, generated on login and refreshed during token rotation.
3. **Server-Side Session Rotation & Revocation:**
   - `/api/auth/login`: Authenticates with the backend, stores access/refresh tokens in secure HTTP-only cookies, and generates the CSRF token.
   - `/api/auth/refresh`: Performs atomic server-side refresh token rotation with replay detection.
   - `/api/auth/logout`: Calls the backend session revocation endpoint, deletes active database sessions, and clears browser cookies.
4. **Token Verification:**
   The admin proxy validates backend-issued RS256 access tokens using the base64-encoded SPKI public key, validates issuer/audience/expiry claims, verifies the global `ADMIN` or `SUPER_ADMIN` platform-admin role, and cross-checks the current `role_version` with the backend.
5. **No Browser Credential Exposure:**
   Never prefix any admin/service credential with `NEXT_PUBLIC_`. The browser client never receives privileged API keys. All communication with backend APIs occurs through server-side route handlers.

### Required Server-Side Environment Variables

Configured in the Vercel Project Settings (Production / Preview):

- `ADMIN_AUTH_ENFORCE=true`
- `JWT_PUBLIC_KEY` — base64-encoded SPKI public PEM; private signing key remains strictly in the backend secret store.
- `INTERNAL_API_KEY` — server-only key matching the backend configuration.
- `ADMIN_API_KEYS` — comma-separated server-only keys matching the backend configuration.
- `BACKEND_API_URL` — backend origin URL (e.g. `https://taxbridge-api-ker8.onrender.com`), without API path prefix.

## Cold-Start & Degraded-State Resilience

Render web services may experience latency or cold-start delays during initial wake-up.
- **Graceful Degraded Fallbacks:**
  Routes in `app/api/admin/` utilize `lib/adminApiFallback.ts` to return structured fallback payloads (`{ fallback: true, warnings: ['backend_warming_up'] }`) rather than 503 errors when the backend is warming up.
- **Operator Feedback:**
  Dashboard UI surfaces (Overview, Analytics, Compliance, Invoices, System) display contextual warning banners while preventing misleading empty states or corrupted data exports.

## Testing & Quality Assurance

- **Jest Web Primitives Polyfill:**
  Unit and integration tests run under Node with `admin-dashboard/jest.polyfill.js`, which polyfills `Request`, `Response`, `Headers`, and `TextEncoder` to mirror Next.js 16 runtime behavior.
- **Verification Commands:**
  - Type check: `npm run type-check --workspace=admin-dashboard`
  - Unit tests: `npm run test --workspace=admin-dashboard`
  - Production build: `npm run build --workspace=admin-dashboard`

## Release constraints

The Vercel project root/runtime configuration is distinct from the backend container runtime. The backend remains on the pinned Node 20 image used by Render; the admin dashboard is built on the Node runtime selected for the Vercel project. Do not change the backend runtime to resolve a Vercel build-runtime error.

A successful Vercel build does not establish API readiness, authorization correctness, end-to-end admin workflows, or customer web-product completeness. Those remain separate release gates.
