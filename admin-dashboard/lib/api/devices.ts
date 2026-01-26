import { fetchJson } from '../fetcher';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

export interface Device {
  id: string;
  deviceId: string;
  platform: 'android' | 'ios';
  active: boolean;
  lastHeartbeat: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  _count: {
    syncJobs: number;
    conflicts: number;
  };
}

export interface DevicesResponse {
  success: boolean;
  devices: Device[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SyncStats {
  success: boolean;
  stats: {
    devices: {
      total: number;
      active: number;
      byPlatform: Array<{ platform: string; count: number }>;
    };
    syncJobs: {
      total: number;
      pending: number;
      processing: number;
      synced: number;
      failed: number;
      conflict: number;
    };
    conflicts: {
      total: number;
      unresolved: number;
      resolved: number;
    };
    recentActivity: Array<{ status: string; count: number }>;
  };
}

export interface Conflict {
  id: string;
  userId: string;
  deviceId: string;
  invoiceId: string;
  entity: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  clientVersion: number;
  serverVersion: number;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  invoice: {
    id: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  device: {
    id: string;
    deviceId: string;
    platform: string;
    userId: string;
  };
}

export interface ConflictsResponse {
  success: boolean;
  conflicts: Conflict[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SyncJob {
  id: string;
  deviceId: string;
  userId: string;
  clientId: string;
  entity: string;
  action: string;
  operation: string;
  status: string;
  createdAt: string;
  device: {
    id: string;
    deviceId: string;
    platform: string;
    userId: string;
  };
}

export interface PendingSyncJobsResponse {
  success: boolean;
  jobs: SyncJob[];
  count: number;
}

export async function fetchDevices(params?: {
  page?: number;
  limit?: number;
  platform?: string;
  active?: boolean;
}): Promise<DevicesResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.platform) query.set('platform', params.platform);
  if (params?.active !== undefined) query.set('active', params.active.toString());

  return fetchJson<DevicesResponse>(`${API_BASE}/api/admin/devices?${query}`, {
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
    },
  });
}

export async function fetchSyncStats(): Promise<SyncStats> {
  return fetchJson<SyncStats>(`${API_BASE}/api/admin/sync/stats`, {
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
    },
  });
}

export async function fetchConflicts(params?: {
  page?: number;
  limit?: number;
  resolution?: string;
  userId?: string;
}): Promise<ConflictsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.resolution) query.set('resolution', params.resolution);
  if (params?.userId) query.set('userId', params.userId);

  return fetchJson<ConflictsResponse>(`${API_BASE}/api/admin/conflicts?${query}`, {
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
    },
  });
}

export async function fetchPendingSyncJobs(params?: {
  limit?: number;
  status?: string;
}): Promise<PendingSyncJobsResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.status) query.set('status', params.status);

  return fetchJson<PendingSyncJobsResponse>(`${API_BASE}/api/admin/sync/pending?${query}`, {
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
    },
  });
}

export async function forceDeviceSync(deviceId: string, reason?: string): Promise<{
  success: boolean;
  message: string;
  syncJobId: string;
}> {
  return fetchJson(`${API_BASE}/api/admin/device/force-sync`, {
    method: 'POST',
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceId, reason }),
  });
}
