/**
 * Device State Machine
 * 
 * Phase 4: Device + Sync State Machine Formalization
 * 
 * Device Lifecycle States:
 *  - UNREGISTERED: Device not yet registered with backend
 *  - REGISTERED: Device registered but not active (no heartbeat)
 *  - ACTIVE: Device actively syncing (heartbeat within threshold)
 *  - SUSPENDED: Device suspended by admin or inactive too long
 * 
 * State Transitions:
 *  UNREGISTERED → REGISTERED (on first heartbeat success)
 *  REGISTERED → ACTIVE (on successful sync or heartbeat)
 *  ACTIVE → SUSPENDED (admin action or timeout)
 *  SUSPENDED → ACTIVE (admin reactivation or re-authentication)
 */

export type DeviceState = 'UNREGISTERED' | 'REGISTERED' | 'ACTIVE' | 'SUSPENDED';

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  osVersion: string | null;
  appVersion: string;
  registeredAt: number | null;
  lastHeartbeatAt: number | null;
  lastSyncAt: number | null;
}

export interface DeviceSnapshot {
  state: DeviceState;
  info: DeviceInfo | null;
  pendingJobs: number;
  suspensionReason: string | null;
}

export type DeviceEvent =
  | { type: 'DEVICE_INIT'; payload: { deviceId: string; platform: string; osVersion: string | null; appVersion: string } }
  | { type: 'DEVICE_REGISTER_SUCCESS'; payload: { registeredAt: number } }
  | { type: 'DEVICE_HEARTBEAT_SUCCESS'; payload: { timestamp: number; pendingJobs: number } }
  | { type: 'DEVICE_SYNC_SUCCESS'; payload: { timestamp: number } }
  | { type: 'DEVICE_SUSPENDED'; payload: { reason: string } }
  | { type: 'DEVICE_REACTIVATED' }
  | { type: 'DEVICE_RESET' };

export const initialDeviceState: DeviceSnapshot = {
  state: 'UNREGISTERED',
  info: null,
  pendingJobs: 0,
  suspensionReason: null,
};

/**
 * Device State Reducer
 * 
 * Pure state machine - all transitions via events
 * NO mutations allowed outside this reducer
 */
export function deviceReducer(state: DeviceSnapshot, event: DeviceEvent): DeviceSnapshot {
  switch (event.type) {
    case 'DEVICE_INIT':
      // Initialize device info (happens at boot)
      return {
        ...state,
        info: {
          deviceId: event.payload.deviceId,
          platform: event.payload.platform,
          osVersion: event.payload.osVersion,
          appVersion: event.payload.appVersion,
          registeredAt: null,
          lastHeartbeatAt: null,
          lastSyncAt: null,
        },
      };

    case 'DEVICE_REGISTER_SUCCESS':
      // First successful registration with backend
      if (state.state === 'UNREGISTERED' && state.info) {
        return {
          ...state,
          state: 'REGISTERED',
          info: {
            ...state.info,
            registeredAt: event.payload.registeredAt,
            lastHeartbeatAt: event.payload.registeredAt,
          },
        };
      }
      return state;

    case 'DEVICE_HEARTBEAT_SUCCESS':
      // Regular heartbeat updates
      if (state.info) {
        const newState: DeviceState = 
          state.state === 'UNREGISTERED' ? 'REGISTERED' :
          state.state === 'SUSPENDED' ? 'SUSPENDED' : // Stay suspended until explicit reactivation
          'ACTIVE'; // REGISTERED or ACTIVE → ACTIVE

        return {
          ...state,
          state: newState,
          info: {
            ...state.info,
            lastHeartbeatAt: event.payload.timestamp,
          },
          pendingJobs: event.payload.pendingJobs,
        };
      }
      return state;

    case 'DEVICE_SYNC_SUCCESS':
      // Sync success confirms device is active
      if (state.info && state.state !== 'SUSPENDED') {
        return {
          ...state,
          state: 'ACTIVE',
          info: {
            ...state.info,
            lastSyncAt: event.payload.timestamp,
          },
        };
      }
      return state;

    case 'DEVICE_SUSPENDED':
      // Admin suspension or policy violation
      return {
        ...state,
        state: 'SUSPENDED',
        suspensionReason: event.payload.reason,
      };

    case 'DEVICE_REACTIVATED':
      // Admin or user re-activates device
      if (state.state === 'SUSPENDED') {
        return {
          ...state,
          state: state.info?.registeredAt ? 'REGISTERED' : 'UNREGISTERED',
          suspensionReason: null,
        };
      }
      return state;

    case 'DEVICE_RESET':
      // Full device reset (logout, consent revoked, etc.)
      return initialDeviceState;

    default:
      return state;
  }
}

/**
 * Device State Validation
 */
export function canSync(deviceState: DeviceState): boolean {
  return deviceState === 'REGISTERED' || deviceState === 'ACTIVE';
}

export function canRegister(deviceState: DeviceState): boolean {
  return deviceState === 'UNREGISTERED';
}

export function isSuspended(deviceState: DeviceState): boolean {
  return deviceState === 'SUSPENDED';
}

/**
 * Device State Timeout Thresholds
 */
export const DEVICE_TIMEOUTS = {
  HEARTBEAT_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  HEARTBEAT_STALE_MS: 15 * 60 * 1000, // 15 minutes (3x interval)
  SYNC_STALE_MS: 24 * 60 * 60 * 1000, // 24 hours
  INACTIVE_SUSPEND_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

/**
 * Check if device should transition to inactive state
 */
export function isDeviceStale(lastHeartbeatAt: number | null): boolean {
  if (!lastHeartbeatAt) return true;
  return Date.now() - lastHeartbeatAt > DEVICE_TIMEOUTS.HEARTBEAT_STALE_MS;
}

export function shouldSuspendInactive(lastHeartbeatAt: number | null): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - lastHeartbeatAt > DEVICE_TIMEOUTS.INACTIVE_SUSPEND_MS;
}
