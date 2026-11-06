import { isSameOriginAuthRequest } from '../lib/auth-origin';

describe('cookie-auth same-origin validation', () => {
  const appOrigin = 'https://admin.taxbridge.ng';

  it('accepts the exact same origin', () => {
    expect(isSameOriginAuthRequest(appOrigin, appOrigin)).toBe(true);
  });

  it('rejects a cross-origin request', () => {
    expect(isSameOriginAuthRequest('https://attacker.example', appOrigin)).toBe(false);
  });

  it('rejects a missing Origin header', () => {
    expect(isSameOriginAuthRequest(null, appOrigin)).toBe(false);
  });

  it('rejects lookalike origins', () => {
    expect(isSameOriginAuthRequest('https://admin.taxbridge.ng.attacker.example', appOrigin)).toBe(false);
    expect(isSameOriginAuthRequest('http://admin.taxbridge.ng', appOrigin)).toBe(false);
  });
});
