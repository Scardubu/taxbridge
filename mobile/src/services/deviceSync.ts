import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform, NativeModules } from 'react-native';
import { getAccessToken } from './authTokens';
import { getApiBaseUrl } from './config';
import { createLogger } from '../utils/logger';
import { getPendingInvoices } from './database';
import { checkConsent } from './api';
import type { InvoiceItem } from '../types/invoice';
import jwt from 'jwt-decode';

const log = createLogger('device-sync');

const DEVICE_ID_STORAGE_KEY = 'device:deviceId';
const CONSENT_CHECKED_KEY = 'device:consentChecked';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate stable device ID (NDPC-compliant: requires consent)
export async function getDeviceId(): Promise<string> {
  const cached = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY).catch(() => null);
  if (cached) return cached;

  // Check if user has granted device_tracking consent
  const token = await getAccessToken();
  if (token) {
    try {
      const decoded = jwt<{ userId?: string }>(token);
      if (decoded.userId) {
        const hasConsent = await checkConsent(decoded.userId, 'device_tracking');
        if (!hasConsent) {
          log.warn('Device tracking consent not granted, using session-only ID');
          // Return session-only UUID that won't be persisted
          return generateUuid();
        }
      }
    } catch (err) {
      log.error('Failed to check device tracking consent', { error: err });
      // Fail-safe: don't persist device ID without explicit consent
      return generateUuid();
    }
  } else {
    // User not authenticated - use session-only ID
    return generateUuid();
  }

  // User has granted consent - generate and persist device ID
  let deviceId: string | null = null;

  if (Platform.OS === 'android') {
    deviceId = Application.getAndroidId();
  } else if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
    deviceId = await Application.getIosIdForVendorAsync().catch(() => null);
  }

  if (!deviceId) {
    deviceId = generateUuid();
  }

  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId).catch(() => undefined);
  await AsyncStorage.setItem(CONSENT_CHECKED_KEY, 'true').catch(() => undefined);
  log.info('Device ID generated and persisted with user consent');
  return deviceId;
}

/**
 * Collect local changes from SQLite queue for device sync push.
 * Transforms pending invoices into LocalChange format.
 */
export async function collectLocalChanges(): Promise<LocalChange[]> {
  try {
    const pending = await getPendingInvoices();
    log.info('Collected local changes', { count: pending.length });
    
    return pending.map((inv) => {
      const items = JSON.parse(inv.items) as InvoiceItem[];
      
      return {
        action: 'create' as const,
        entityType: 'invoice' as const,
        entityId: inv.id,
        data: {
          id: inv.id,
          customerName: inv.customerName ?? undefined,
          status: inv.status,
          subtotal: inv.subtotal,
          vat: inv.vat,
          total: inv.total,
          items,
          createdAt: inv.createdAt,
        },
        version: inv.attempts ?? 0,
      };
    });
  } catch (err) {
    log.error('Failed to collect local changes', { error: err });
    return [];
  }
}

interface HeartbeatPayload {
  deviceId: string;
  platform: string;
  osVersion: string | null;
  appVersion: string;
  network?: string;
  batteryPct?: number;
  lastSeenAt?: string;
  locale?: string;
}

interface HeartbeatResponse {
  success: boolean;
  device: {
    id: string;
    deviceId: string;
    platform: string;
    lastHeartbeat: string;
  };
  pendingJobs: number;
}

interface SyncPullResponse {
  success: boolean;
  invoices: any[];
  hasMore: boolean;
  nextSince?: string;
  timestamp: string;
}

type LocalChange = {
  action: 'create' | 'update' | 'delete';
  entityType: 'invoice';
  entityId: string;
  data?: Record<string, unknown>;
  version?: number;
};

interface SyncPushPayload {
  deviceId: string;
  jobs: Array<{
    clientId: string;
    entity: 'invoice';
    action: 'create' | 'update' | 'delete';
    clientVersion: number;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  clientTime: string;
  lastSyncAt?: string;
}

interface SyncPushResponse {
  success: boolean;
  synced: string[];
  conflicts: string[];
  failed: string[];
}

interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: number;
  serverVersion: number;
  localData: any;
  serverData: any;
  createdAt: string;
}

interface ConflictListResponse {
  success: boolean;
  conflicts: Conflict[];
}

interface ConflictResolutionPayload {
  conflictId: string;
  resolution: 'local_wins' | 'server_wins' | 'merged';
  mergedData?: any;
}

interface ConflictResolutionResponse {
  success: boolean;
  message: string;
}

/**
 * Send device heartbeat to register/update device presence
 */
export async function sendHeartbeat(): Promise<HeartbeatResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = await getDeviceId();
  const apiBaseUrl = await getApiBaseUrl();
  
  // Get device locale safely
  let locale: string | undefined;
  try {
    if (Platform.OS === 'ios') {
      locale = NativeModules.SettingsManager?.settings?.AppleLocale || 
               NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier;
    }
  } catch {
    locale = undefined;
  }
  
  const payload: HeartbeatPayload = {
    deviceId,
    platform: Platform.OS,
    osVersion: Device.osVersion || null,
    appVersion: Application.nativeApplicationVersion || '1.0.0',
    lastSeenAt: new Date().toISOString(),
    locale
  };

  log.info('Sending heartbeat', { deviceId, platform: payload.platform });

  const response = await fetch(`${apiBaseUrl}/api/v1/device/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Heartbeat failed: ${response.status}`);
  }

  const data = await response.json();
  log.info('Heartbeat successful', { pendingJobs: data.pendingJobs });
  return data;
}

/**
 * Pull updates from server (delta sync)
 */
export async function syncPull(since?: string): Promise<SyncPullResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = await getDeviceId();
  const apiBaseUrl = await getApiBaseUrl();
  const params = new URLSearchParams({ deviceId });
  if (since) {
    params.append('since', since);
  }

  log.info('Pulling sync updates', { deviceId, since });

  const response = await fetch(`${apiBaseUrl}/api/v1/sync/pull?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Sync pull failed: ${response.status}`);
  }

  const data = await response.json();
  log.info('Sync pull successful', { 
    invoiceCount: data.invoices.length, 
    hasMore: data.hasMore 
  });
  return data;
}

/**
 * Push local changes to server
 */
export async function syncPush(changes: LocalChange[]): Promise<SyncPushResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = await getDeviceId();
  const apiBaseUrl = await getApiBaseUrl();
  const payload: SyncPushPayload = {
    deviceId,
    jobs: changes.map((change) => ({
      clientId: change.entityId,
      entity: change.entityType,
      action: change.action,
      clientVersion: change.version ?? 0,
      payload: { id: change.entityId, ...(change.data || {}) },
      createdAt: new Date().toISOString()
    })),
    clientTime: new Date().toISOString()
  };

  log.info('Pushing sync changes', { deviceId, changeCount: changes.length });

  const response = await fetch(`${apiBaseUrl}/api/v1/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Sync push failed: ${response.status}`);
  }

  const data = await response.json();
  log.info('Sync push successful', { 
    synced: data.synced?.length ?? 0,
    conflicts: data.conflicts?.length ?? 0,
    failed: data.failed?.length ?? 0
  });
  return data;
}

/**
 * List unresolved conflicts for device
 */
export async function listConflicts(): Promise<ConflictListResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = await getDeviceId();
  const apiBaseUrl = await getApiBaseUrl();
  const params = new URLSearchParams({ deviceId });

  log.info('Fetching conflicts', { deviceId });

  const response = await fetch(`${apiBaseUrl}/api/v1/sync/conflicts?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Conflict list failed: ${response.status}`);
  }

  const data = await response.json();
  log.info('Conflicts fetched', { conflictCount: data.conflicts.length });
  return data;
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'local_wins' | 'server_wins' | 'merged',
  mergedData?: any
): Promise<ConflictResolutionResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = await getDeviceId();
  const apiBaseUrl = await getApiBaseUrl();
  const payload: ConflictResolutionPayload = {
    conflictId,
    resolution,
    ...(mergedData && { mergedData })
  };

  log.info('Resolving conflict', { deviceId, conflictId, resolution });

  const response = await fetch(`${apiBaseUrl}/api/v1/sync/conflicts/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Conflict resolution failed: ${response.status}`);
  }

  const data = await response.json();
  log.info('Conflict resolved', { conflictId });
  return data;
}

export async function performFullSync(localChanges: LocalChange[] = []): Promise<{
  heartbeat: HeartbeatResponse;
  pulled: SyncPullResponse;
  pushed?: SyncPushResponse;
}> {
  log.info('Starting full sync');

  // 1. Send heartbeat
  const heartbeat = await sendHeartbeat();

  // 2. Pull updates from server
  let allInvoices: any[] = [];
  let nextSince: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const pullResult = await syncPull(nextSince);
    allInvoices = [...allInvoices, ...pullResult.invoices];
    hasMore = pullResult.hasMore;
    nextSince = pullResult.nextSince;
  }

  const pulled: SyncPullResponse = {
    success: true,
    invoices: allInvoices,
    hasMore: false,
    timestamp: new Date().toISOString()
  };

  // 3. Push local changes if any
  let pushed: SyncPushResponse | undefined;
  if (localChanges.length > 0) {
    pushed = await syncPush(localChanges);
  }

  log.info('Full sync complete', { 
    pulledCount: allInvoices.length,
    pushedCount: localChanges.length 
  });

  return { heartbeat, pulled, pushed };
}
