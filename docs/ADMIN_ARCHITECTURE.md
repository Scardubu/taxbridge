# TaxBridge Admin Architecture

## Canonical application

- **Canonical web application:** `admin-dashboard/`.
- **Framework:** Next.js 16 / React 19.
- **Vercel project root:** `admin-dashboard`.
- **Package runtime:** Node `26.x` for the current Vercel build environment.
- **Build:** `npm ci`, then `npm run build`.
- **Output:** `.next`.
- **API:** the Fastify service; browser code must use authenticated same-origin server routes for privileged operations.

The separate `admin/` directory is not the canonical deployment target. It must not receive production traffic unless it is explicitly re-approved as a separately owned application with an independent security review.

## Product boundary

The current web application is an internal operations/admin console. This codebase does not currently establish a complete customer-facing SME web portal. Do not claim that SME registration, onboarding, invoice/receipt management, tax filing and account-security journeys are available on web merely because corresponding mobile or backend modules exist.

## Authentication boundary

The production admin proxy validates backend-issued RS256 access tokens using the base64-encoded SPKI public key, checks issuer/audience and required claims, enforces the admin role, and obtains the current role version from the backend through the internal service-key endpoint. Privileged mutations require CSRF validation.

Required server-side production variables:

- `ADMIN_AUTH_ENFORCE=true`
- `JWT_PUBLIC_KEY` — base64-encoded SPKI public PEM; private signing key remains in the backend secret store.
- `INTERNAL_API_KEY` — server-only key matching the backend configuration.
- `ADMIN_API_KEYS` — comma-separated server-only keys matching the backend configuration.
- `BACKEND_API_URL` — backend origin, without an API path prefix.

Never prefix any admin/service credential with `NEXT_PUBLIC_`. The browser must not receive the privileged admin API key.

## Release constraints

The Vercel project root/runtime configuration is distinct from the backend container runtime. The backend remains on the pinned Node 20 image used by Render; the admin dashboard is built on the Node runtime selected for the Vercel project. Do not change the backend runtime to resolve a Vercel build-runtime error.

A successful Vercel build does not establish API readiness, authorization correctness, end-to-end admin workflows or customer web-product completeness. Those remain separate release gates.
