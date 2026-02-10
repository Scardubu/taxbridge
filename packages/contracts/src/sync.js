"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushSyncSchema = exports.SyncJobSchema = exports.SyncActionSchema = exports.SyncEntitySchema = exports.HeartbeatSchema = exports.UuidSchema = void 0;
const zod_1 = require("zod");
exports.UuidSchema = zod_1.z.string().uuid();
exports.HeartbeatSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1),
    userId: exports.UuidSchema.optional(),
    platform: zod_1.z.enum(['android', 'ios', 'web']),
    appVersion: zod_1.z.string().min(1),
    osVersion: zod_1.z.string().min(1).optional(),
    locale: zod_1.z.string().min(2).optional(),
    lastSeenAt: zod_1.z.string().datetime().optional(),
    network: zod_1.z.enum(['online', 'offline']).optional(),
    batteryPct: zod_1.z.number().min(0).max(100).optional()
});
exports.SyncEntitySchema = zod_1.z.enum(['invoice', 'payment', 'receipt', 'settings', 'profile']);
exports.SyncActionSchema = zod_1.z.enum(['create', 'update', 'delete']);
exports.SyncJobSchema = zod_1.z.object({
    clientId: zod_1.z.string().min(1),
    entity: exports.SyncEntitySchema,
    action: exports.SyncActionSchema,
    clientVersion: zod_1.z.number().int().min(0),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    createdAt: zod_1.z.string().datetime()
});
exports.PushSyncSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1),
    jobs: zod_1.z.array(exports.SyncJobSchema).min(1),
    clientTime: zod_1.z.string().datetime(),
    lastSyncAt: zod_1.z.string().datetime().optional()
});
