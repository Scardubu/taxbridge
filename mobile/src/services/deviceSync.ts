import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAccessToken } from './authTokens';
import { createLogger } from '../utils/logger';

const log = createLogger('device-sync');

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.taxbridge.ng';

// Generate stable device ID
export function getDeviceId(): string {
  // Use platform-specific stable identifiers
  if (Platform.OS === 'android') {
    return Application.androidId || `android-${Device.modelId || 'unknown'}`;
  } else if (Platform.OS === 'ios') {
    // iOS doesn't provide a stable device ID, use vendorId + device name
    const vendorId = Application.getIosIdForVendorAsync ? 'ios-vendor' : 'ios-fallback';
    return `${vendorId}-${Device.modelId || 'unknown'}`;
  }
  return `web-${Math.random().toString(36).substr(2, 9)}`;
}

interface HeartbeatPayload {
  deviceId: string;
  platform: string;
  osVersion: string | null;
  appVersion: string;
  network?: string;
  batteryPct?: number;
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

interface SyncPushPayload {
  deviceId: string;
  changes: Array<{
    action: 'create' | 'update' | 'delete';
    entityType: 'invoice';
    entityId: string;
    data?: any;
    version?: number;
  }>;
}

interface SyncPushResponse {
  success: boolean;
  jobId: string;
  message: string;
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

  const deviceId = getDeviceId();
  const payload: HeartbeatPayload = {
    deviceId,
    platform: Platform.OS,
    osVersion: Device.osVersion || null,
    appVersion: Application.nativeApplicationVersion || '1.0.0'
  };

  log.info('Sending heartbeat', { deviceId, platform: payload.platform });

  const response = await fetch(`${API_BASE_URL}/api/v1/device/heartbeat`, {
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

  const deviceId = getDeviceId();
  const params = new URLSearchParams({ deviceId });
  if (since) {
    params.append('since', since);
  }

  log.info('Pulling sync updates', { deviceId, since });

  const response = await fetch(`${API_BASE_URL}/api/v1/sync/pull?${params.toString()}`, {
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
export async function syncPush(changes: SyncPushPayload['changes']): Promise<SyncPushResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const deviceId = getDeviceId();
  const payload: SyncPushPayload = {
    deviceId,
    changes
  };

  log.info('Pushing sync changes', { deviceId, changeCount: changes.length });

  const response = await fetch(`${API_BASE_URL}/api/v1/sync/push`, {
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
  log.info('Sync push successful', { jobId: data.jobId });
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

  const deviceId = getDeviceId();
  const params = new URLSearchParams({ deviceId });

  log.info('Fetching conflicts', { deviceId });

  const response = await fetch(`${API_BASE_URL}/api/v1/sync/conflicts?${params.toString()}`, {
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

  const deviceId = getDeviceId();
  const payload: ConflictResolutionPayload = {
    conflictId,
    resolution,
    ...(mergedData && { mergedData })
  };

  log.info('Resolving conflict', { deviceId, conflictId, resolution });

  const response = await fetch(`${API_BASE_URL}/api/v1/sync/conflicts/resolve`, {
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

/**
 * Full sync operation: heartbeat → pull → push local changes
 */
export async function performFullSync(localChanges: SyncPushPayload['changes'] = []): Promise<{
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
