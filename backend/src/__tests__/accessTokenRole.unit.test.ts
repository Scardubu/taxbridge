import { resolveAccessTokenRole } from '../services/accessTokenRole';

describe('resolveAccessTokenRole', () => {
  it.each(['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'])(
    'preserves global platform role %s',
    (role) => {
      expect(resolveAccessTokenRole(role, 'OWNER')).toBe(
        role.toUpperCase() === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      );
    },
  );

  it('uses the selected organization membership role for tenant administrators', () => {
    expect(resolveAccessTokenRole('OWNER', 'ACCOUNTANT')).toBe('ACCOUNTANT');
    expect(resolveAccessTokenRole('owner', 'admin')).toBe('ADMIN');
  });

  it('does not elevate a tenant role from a missing platform role', () => {
    expect(resolveAccessTokenRole(null, 'VIEWER')).toBe('VIEWER');
    expect(resolveAccessTokenRole(undefined, 'OWNER')).toBe('OWNER');
  });

  it('normalizes the fallback global role when membership role is absent', () => {
    expect(resolveAccessTokenRole('OWNER', null)).toBe('OWNER');
  });
});
