import Fastify, { FastifyInstance } from 'fastify';
import privacyRoutes from '../privacy';
import { privacyService } from '../../services/privacy';

jest.mock('../../services/privacy', () => ({
  privacyService: {
    exportUserData: jest.fn(),
    exportPortableData: jest.fn(),
    deleteUserData: jest.fn(),
    updateConsent: jest.fn(),
    hasConsent: jest.fn(),
  },
}));

jest.mock('../../lib/security', () => ({
  logSecurityEvent: jest.fn(),
}));

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

describe('privacy routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    (app as any).decorate('authenticate', async (request: any) => {
      request.user = { userId: USER_ID };
    });
    await app.register(privacyRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers the complete privacy route contract without a duplicate prefix', () => {
    const routes = app.printRoutes();
    expect(routes).toContain('/api/v1/privacy/export/:userId');
    expect(routes).toContain('/api/v1/privacy/download/:userId');
    expect(routes).toContain('/api/v1/privacy/delete');
    expect(routes).toContain('/api/v1/privacy/consent');
    expect(routes).toContain('/api/v1/privacy/consent/:userId/:consentType');
  });

  it('allows a user to export their own data', async () => {
    (privacyService.exportUserData as jest.Mock).mockResolvedValue({ personal: { name: 'Test' } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/privacy/export/${USER_ID}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, data: { personal: { name: 'Test' } } });
    expect(privacyService.exportUserData).toHaveBeenCalledWith(USER_ID);
  });

  it('denies cross-user exports without invoking the service', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/privacy/export/${OTHER_USER_ID}` });
    expect(response.statusCode).toBe(403);
    expect(privacyService.exportUserData).not.toHaveBeenCalled();
  });

  it('denies cross-user deletion and does not invoke the erasure service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/delete',
      payload: { userId: OTHER_USER_ID, reason: 'User requested account erasure' },
    });
    expect(response.statusCode).toBe(403);
    expect(privacyService.deleteUserData).not.toHaveBeenCalled();
  });

  it('returns a safe 500 response instead of leaking service exception text', async () => {
    (privacyService.exportUserData as jest.Mock).mockRejectedValue(
      new Error('database password and connection string'),
    );
    const response = await app.inject({ method: 'GET', url: `/api/v1/privacy/export/${USER_ID}` });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'PRIVACY_OPERATION_FAILED' });
    expect(response.body).not.toContain('database password');
  });

  it('maps an unknown user to a stable 404 without exposing exception text', async () => {
    (privacyService.exportUserData as jest.Mock).mockRejectedValue(new Error('User not found'));
    const response = await app.inject({ method: 'GET', url: `/api/v1/privacy/export/${USER_ID}` });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it('validates consent payloads and blocks cross-user consent changes', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/consent',
      payload: { userId: USER_ID, consentType: 'unexpected', granted: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual(expect.objectContaining({ error: 'VALIDATION_ERROR' }));

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/consent',
      payload: { userId: OTHER_USER_ID, consentType: 'data_processing', granted: true },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(privacyService.updateConsent).not.toHaveBeenCalled();
  });

  it('allows a user to check only their own consent', async () => {
    (privacyService.hasConsent as jest.Mock).mockResolvedValue(true);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/privacy/consent/${USER_ID}/data_processing`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, hasConsent: true });
    expect(privacyService.hasConsent).toHaveBeenCalledWith(USER_ID, 'data_processing');
  });
});
