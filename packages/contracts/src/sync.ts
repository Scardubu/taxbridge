import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const HeartbeatSchema = z.object({
  deviceId: z.string().min(1),
  userId: UuidSchema.optional(),
  platform: z.enum(['android', 'ios', 'web']),
  appVersion: z.string().min(1),
  osVersion: z.string().min(1).optional(),
  locale: z.string().min(2).optional(),
  lastSeenAt: z.string().datetime().optional(),
  network: z.enum(['online', 'offline']).optional(),
  batteryPct: z.number().min(0).max(100).optional()
});

export const SyncEntitySchema = z.enum(['invoice', 'payment', 'expense', 'receipt', 'settings', 'profile']);
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
  deviceId: z.string().min(1),
  jobs: z.array(SyncJobSchema).min(1),
  clientTime: z.string().datetime(),
  lastSyncAt: z.string().datetime().optional()
});

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().nullable(),
  entity: SyncEntitySchema,
  action: SyncActionSchema,
  clientVersion: z.number().int().min(0).default(0),
  payload: z.record(z.string(), z.any()),
  createdAt: z.string().datetime(),
  attempts: z.number().int().min(0).default(0),
  lastError: z.string().nullable().default(null),
  nextRetry: z.string().datetime().nullable().default(null),
});

export const PullSyncResponseSchema = z.object({
  success: z.boolean(),
  invoices: z.array(z.any()),
  hasMore: z.boolean(),
  nextSince: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type SyncJobPayload = z.infer<typeof SyncJobSchema>;
export type PushSyncPayload = z.infer<typeof PushSyncSchema>;
export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;
export type PullSyncResponse = z.infer<typeof PullSyncResponseSchema>;
