/**
 * Device Context
 * 
 * Phase 4: Device + Sync State Machine Formalization
 * 
 * Manages device lifecycle state (UNREGISTERED → REGISTERED → ACTIVE → SUSPENDED).
 * Provides read-only access to device state.
 * 
 * Rules:
 *  - Device state transitions ONLY via reducer events
 *  - NO direct mutations from components
 *  - State persisted to AsyncStorage automatically
 *  - Heartbeat managed internally (background)
 */

import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetwork } from './NetworkContext';
import { sendHeartbeat } from '../services/deviceSync';
import { getAccessToken } from '../services/authTokens';
import { saveDeviceState, loadDeviceState } from '../services/deviceStatePersistence';
import { createLogger } from '../utils/logger';
import {
  deviceReducer,
  initialDeviceState,
  canSync,
  isSuspended,
  DEVICE_TIMEOUTS,
  type DeviceState,
  type DeviceInfo,
  type DeviceSnapshot,
} from '../sync/deviceReducer';

const log = createLogger('device-context');

interface DeviceContextValue {
  // Read-only device state
  deviceState: DeviceState;
  deviceInfo: DeviceInfo | null;
  pendingJobs: number;
  suspensionReason: string | null;
  
  // Device state queries
  canSync: boolean;
  isSuspended: boolean;
  isRegistered: boolean;
  
  // Device actions (emit events internally)
  registerDevice: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextValue | undefined>(undefined);

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) {
    throw new Error('useDevice must be used within DeviceProvider');
  }
  return ctx;
}

interface DeviceProviderProps {
  children: React.ReactNode;
  initialDeviceInfo?: {
    deviceId: string;
    platform: string;
    osVersion: string | null;
    appVersion: string;
  };
  initialPersistedState?: DeviceSnapshot | null;
}

export function DeviceProvider({ 
  children, 
  initialDeviceInfo,
  initialPersistedState 
}: DeviceProviderProps) {
  const { isOnline } = useNetwork();
  const [state, dispatch] = useReducer(
    deviceReducer,
    initialPersistedState || initialDeviceState
  );
  
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize device info on mount
  useEffect(() => {
    if (initialDeviceInfo && !state.info) {
      log.info('Initializing device info', { deviceId: initialDeviceInfo.deviceId });
      dispatch({
        type: 'DEVICE_INIT',
        payload: initialDeviceInfo,
      });
    }
  }, [initialDeviceInfo, state.info]);

  // Persist device state on changes
  useEffect(() => {
    if (state.state !== 'UNREGISTERED' || state.info) {
      void saveDeviceState(state);
    }
  }, [state]);

  // Register device on first use if authenticated and online
  const registerDevice = useCallback(async () => {
    if (state.state !== 'UNREGISTERED') {
      log.debug('Device already registered', { state: state.state });
      return;
    }

    if (!isOnline) {
      log.warn('Cannot register device while offline');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      log.warn('Cannot register device without authentication');
      return;
    }

    try {
      log.info('Registering device with backend');
      const response = await sendHeartbeat();
      
      dispatch({
        type: 'DEVICE_REGISTER_SUCCESS',
        payload: { registeredAt: Date.now() },
      });
      
      dispatch({
        type: 'DEVICE_HEARTBEAT_SUCCESS',
        payload: { 
          timestamp: Date.now(), 
          pendingJobs: response.pendingJobs || 0 
        },
      });
      
      log.info('Device registered successfully');
    } catch (err) {
      log.error('Device registration failed', { error: err });
    }
  }, [state.state, isOnline]);

  // Send heartbeat
  const sendDeviceHeartbeat = useCallback(async () => {
    if (!isOnline) {
      log.debug('Skipping heartbeat (offline)');
      return;
    }

    if (state.state === 'SUSPENDED') {
      log.debug('Skipping heartbeat (device suspended)');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      log.debug('Skipping heartbeat (not authenticated)');
      return;
    }

    try {
      log.debug('Sending device heartbeat');
      const response = await sendHeartbeat();
      
      dispatch({
        type: 'DEVICE_HEARTBEAT_SUCCESS',
        payload: { 
          timestamp: Date.now(), 
          pendingJobs: response.pendingJobs || 0 
        },
      });
      
      log.debug('Heartbeat sent successfully', { pendingJobs: response.pendingJobs });
    } catch (err: any) {
      log.error('Heartbeat failed', { error: err });
      
      // Check if device was suspended by backend
      if (err.message?.includes('suspended') || err.message?.includes('disabled')) {
        dispatch({
          type: 'DEVICE_SUSPENDED',
          payload: { reason: err.message },
        });
        log.warn('Device suspended by backend', { reason: err.message });
      }
    }
  }, [isOnline, state.state]);

  // Start heartbeat interval when device becomes active
  useEffect(() => {
    if (state.state === 'REGISTERED' || state.state === 'ACTIVE') {
      if (!heartbeatIntervalRef.current) {
        log.info('Starting heartbeat interval');
        
        // Send initial heartbeat
        void sendDeviceHeartbeat();
        
        // Set up interval
        heartbeatIntervalRef.current = setInterval(() => {
          void sendDeviceHeartbeat();
        }, DEVICE_TIMEOUTS.HEARTBEAT_INTERVAL_MS);
      }
    } else {
      // Stop heartbeat if not registered/active
      if (heartbeatIntervalRef.current) {
        log.info('Stopping heartbeat interval');
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [state.state, sendDeviceHeartbeat]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - send heartbeat
        log.info('App became active, sending heartbeat');
        void sendDeviceHeartbeat();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [sendDeviceHeartbeat]);

  // Auto-register device when online and authenticated
  useEffect(() => {
    if (isOnline && state.state === 'UNREGISTERED') {
      void registerDevice();
    }
  }, [isOnline, state.state, registerDevice]);

  const contextValue: DeviceContextValue = {
    // Read-only state
    deviceState: state.state,
    deviceInfo: state.info,
    pendingJobs: state.pendingJobs,
    suspensionReason: state.suspensionReason,
    
    // State queries
    canSync: canSync(state.state),
    isSuspended: isSuspended(state.state),
    isRegistered: state.state !== 'UNREGISTERED',
    
    // Actions
    registerDevice,
    sendHeartbeat: sendDeviceHeartbeat,
  };

  return (
    <DeviceContext.Provider value={contextValue}>
      {children}
    </DeviceContext.Provider>
  );
}
