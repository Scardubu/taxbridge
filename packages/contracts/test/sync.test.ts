import { HeartbeatSchema, PushSyncSchema, SyncJobSchema } from '../src/sync';

describe('contracts: sync schemas', () => {
  it('validates heartbeat payload', () => {
    const payload = {
      deviceId: '3d5f9d85-5f6b-4d1b-8a91-2b07d23f0a6c',
      userId: 'c2e2e0d2-9e62-4f56-9d4d-09ef9c25e8f2',
      platform: 'android',
      appVersion: '5.0.4',
      osVersion: '14',
      locale: 'en-NG',
      lastSeenAt: new Date().toISOString(),
      network: 'online',
      batteryPct: 82
    };

    const result = HeartbeatSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('validates sync job payload', () => {
    const payload = {
      clientId: 'inv_001',
      entity: 'invoice',
      action: 'create',
      clientVersion: 0,
      payload: { total: 12000, currency: 'NGN' },
      createdAt: new Date().toISOString()
    };

    const result = SyncJobSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('validates push sync payload', () => {
    const payload = {
      deviceId: '3d5f9d85-5f6b-4d1b-8a91-2b07d23f0a6c',
      jobs: [
        {
          clientId: 'inv_001',
          entity: 'invoice',
          action: 'create',
          clientVersion: 0,
          payload: { total: 12000, currency: 'NGN' },
          createdAt: new Date().toISOString()
        }
      ],
      clientTime: new Date().toISOString()
    };

    const result = PushSyncSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
