/**
 * Rate limit config objects — TaxBridge V13 Sovereign
 *
 * Per-route rate limit configurations for @fastify/rate-limit.
 * Set on routes as: config: { rateLimit: RATE_LIMITS.login }
 *
 * §5.5 Rate Limits table
 */

export const RATE_LIMITS = {
  /** POST /api/v1/auth/login — 5/min per IP */
  login: {
    max:        5,
    timeWindow: '1 minute',
  },
  /** POST /api/v1/auth/refresh — 10/min per userId */
  refresh: {
    max:          10,
    timeWindow:   '1 minute',
    keyGenerator: (req: any) => req.user?.userId ?? req.ip,
  },
  /** GET /api/v1/dashboard — 30/min per userId */
  dashboard: {
    max:          30,
    timeWindow:   '1 minute',
    keyGenerator: (req: any) => req.user?.userId ?? req.ip,
  },
  /** POST /api/v1/filings/* — 10/min per orgId */
  filings: {
    max:          10,
    timeWindow:   '1 minute',
    keyGenerator: (req: any) => req.orgContext?.orgId ?? req.ip,
  },
  /** POST /api/v1/filings/nil — 5/min per orgId */
  filingsNil: {
    max:          5,
    timeWindow:   '1 minute',
    keyGenerator: (req: any) => req.orgContext?.orgId ?? req.ip,
  },
  /** POST /api/v1/onboarding/tin|cac — 3/min per IP */
  onboarding: {
    max:        3,
    timeWindow: '1 minute',
  },
  /** GET /api/v2/monitoring/metrics — 10/min ADMIN only */
  metrics: {
    max:          10,
    timeWindow:   '1 minute',
    keyGenerator: (req: any) => req.user?.userId ?? req.ip,
  },
} as const;
