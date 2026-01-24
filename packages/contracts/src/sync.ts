import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const HeartbeatSchema = z.object({
  deviceId: UuidSchema,
  userId: UuidSchema,
  platform: z.enum(['android', 'ios', 'web']),
  appVersion: z.string().min(1),
  osVersion: z.string().min(1).optional(),
  locale: z.string().min(2).optional(),
  lastSeenAt: z.string().datetime(),
  network: z.enum(['online', 'offline']).optional(),
  batteryPct: z.number().min(0).max(100).optional()
});

export const SyncEntitySchema = z.enum(['invoice', 'payment', 'receipt', 'settings', 'profile']);
export const SyncActionSchema = z.enum(['create', 'update', 'delete']);

export const SyncJobSchema = z.object({
  clientId: z.string().min(1),
  entity: SyncEntitySchema,
  action: SyncActionSchema,
  clientVersion: z.number().int().min(0),
  payload: z.record(z.string(), z.any()),
  createdAt: z.string().datetime()
});

export const PushSyncSchema = z.object({
  deviceId: UuidSchema,
  jobs: z.array(SyncJobSchema).min(1),
  clientTime: z.string().datetime(),
  lastSyncAt: z.string().datetime().optional()
});

export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type SyncJobPayload = z.infer<typeof SyncJobSchema>;
export type PushSyncPayload = z.infer<typeof PushSyncSchema>;
