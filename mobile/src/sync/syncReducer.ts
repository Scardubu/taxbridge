export function syncReducer(state: DeviceSyncSnapshot, event: any): DeviceSyncSnapshot {
  switch (event.type) {
    case 'DEVICE_REGISTERED':
      return { ...state, deviceState: 'REGISTERED' };

    case 'NETWORK_ONLINE':
      return { ...state, isOnline: true };

    case 'SYNC_START':
      return { ...state, syncState: 'SYNCING' };

    case 'SYNC_SUCCESS':
      return {
        ...state,
        syncState: 'IDLE',
        lastSyncAt: Date.now(),
        pendingJobs: 0,
      };

    case 'SYNC_CONFLICT':
      return { ...state, syncState: 'CONFLICT' };

    case 'SYNC_ERROR':
      return { ...state, syncState: 'ERROR' };

    default:
      return state;
  }
}
