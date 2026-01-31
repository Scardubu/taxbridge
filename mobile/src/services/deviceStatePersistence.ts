/**
 * Device State Persistence
 * 
 * Phase 4: Device + Sync State Machine Formalization
 * 
 * Handles persistence of device lifecycle state to AsyncStorage.
 * Ensures device state survives app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';
import type { DeviceSnapshot } from '../sync/deviceReducer';
import { initialDeviceState } from '../sync/deviceReducer';

const log = createLogger('device-persistence');

const DEVICE_STATE_KEY = 'device:state_v1';

/**
 * Load device state from AsyncStorage
 * Returns initial state if not found or corrupted
 */
export async function loadDeviceState(): Promise<DeviceSnapshot> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_STATE_KEY);
    if (!stored) {
      log.info('No persisted device state found, using initial state');
      return initialDeviceState;
    }

    const parsed = JSON.parse(stored) as DeviceSnapshot;
    
    // Validate structure
    if (!parsed.state || !['UNREGISTERED', 'REGISTERED', 'ACTIVE', 'SUSPENDED'].includes(parsed.state)) {
      log.warn('Invalid device state structure, resetting to initial');
      return initialDeviceState;
    }

    log.info('Device state loaded from storage', { state: parsed.state });
    return parsed;
  } catch (err) {
    log.error('Failed to load device state', { error: err });
    return initialDeviceState;
  }
}

/**
 * Save device state to AsyncStorage
 * Safe to call frequently - AsyncStorage handles debouncing
 */
export async function saveDeviceState(state: DeviceSnapshot): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    await AsyncStorage.setItem(DEVICE_STATE_KEY, serialized);
    log.debug('Device state persisted', { state: state.state });
  } catch (err) {
    log.error('Failed to save device state', { error: err });
    // Don't throw - persistence failures should not crash the app
  }
}

/**
 * Clear device state from AsyncStorage
 * Used during logout or device reset
 */
export async function clearDeviceState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_STATE_KEY);
    log.info('Device state cleared');
  } catch (err) {
    log.error('Failed to clear device state', { error: err });
  }
}

/**
 * Check if device state exists in storage
 * Useful for first-run detection
 */
export async function hasPersistedDeviceState(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_STATE_KEY);
    return stored !== null;
  } catch (err) {
    log.error('Failed to check device state existence', { error: err });
    return false;
  }
}
