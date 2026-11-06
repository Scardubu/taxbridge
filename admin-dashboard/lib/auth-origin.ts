/**
 * Browser cookie-auth endpoints reject requests without an exact same-origin
 * Origin header. These endpoints are not intended for cross-origin clients.
 */
export function isSameOriginAuthRequest(origin: string | null, expectedOrigin: string): boolean {
  return typeof origin === 'string' && origin.length > 0 && origin === expectedOrigin;
}
