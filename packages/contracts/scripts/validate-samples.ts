import { HeartbeatSchema, PushSyncSchema, SyncJobSchema } from '../src/sync';

const heartbeatSample = {
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

const syncJobSample = {
  clientId: 'inv_001',
  entity: 'invoice',
  action: 'create',
  clientVersion: 0,
  payload: { total: 12000, currency: 'NGN' },
  createdAt: new Date().toISOString()
};

const pushSyncSample = {
  deviceId: heartbeatSample.deviceId,
  jobs: [syncJobSample],
  clientTime: new Date().toISOString()
};

const results = [
  HeartbeatSchema.safeParse(heartbeatSample),
  SyncJobSchema.safeParse(syncJobSample),
  PushSyncSchema.safeParse(pushSyncSample)
];

const failed = results.find((result) => !result.success);
if (failed) {
  throw new Error(`Sample validation failed: ${JSON.stringify(failed.error.format())}`);
}

console.log('Contracts samples validated successfully.');
