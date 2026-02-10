import { z } from 'zod';
export declare const UuidSchema: z.ZodString;
export declare const HeartbeatSchema: z.ZodObject<{
    deviceId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    platform: z.ZodEnum<{
        android: "android";
        ios: "ios";
        web: "web";
    }>;
    appVersion: z.ZodString;
    osVersion: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    lastSeenAt: z.ZodOptional<z.ZodString>;
    network: z.ZodOptional<z.ZodEnum<{
        online: "online";
        offline: "offline";
    }>>;
    batteryPct: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SyncEntitySchema: z.ZodEnum<{
    invoice: "invoice";
    receipt: "receipt";
    payment: "payment";
    settings: "settings";
    profile: "profile";
}>;
export declare const SyncActionSchema: z.ZodEnum<{
    create: "create";
    update: "update";
    delete: "delete";
}>;
export declare const SyncJobSchema: z.ZodObject<{
    clientId: z.ZodString;
    entity: z.ZodEnum<{
        invoice: "invoice";
        receipt: "receipt";
        payment: "payment";
        settings: "settings";
        profile: "profile";
    }>;
    action: z.ZodEnum<{
        create: "create";
        update: "update";
        delete: "delete";
    }>;
    clientVersion: z.ZodNumber;
    payload: z.ZodRecord<z.ZodString, z.ZodAny>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const PushSyncSchema: z.ZodObject<{
    deviceId: z.ZodString;
    jobs: z.ZodArray<z.ZodObject<{
        clientId: z.ZodString;
        entity: z.ZodEnum<{
            invoice: "invoice";
            receipt: "receipt";
            payment: "payment";
            settings: "settings";
            profile: "profile";
        }>;
        action: z.ZodEnum<{
            create: "create";
            update: "update";
            delete: "delete";
        }>;
        clientVersion: z.ZodNumber;
        payload: z.ZodRecord<z.ZodString, z.ZodAny>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    clientTime: z.ZodString;
    lastSyncAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type SyncJobPayload = z.infer<typeof SyncJobSchema>;
export type PushSyncPayload = z.infer<typeof PushSyncSchema>;
