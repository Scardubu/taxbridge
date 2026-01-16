import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.useRealTimers();

jest.mock('../../services/authTokens', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token')
}));

// Provide a mock NetworkContext module with a setter so tests can update it safely
jest.mock('../NetworkContext', () => {
  let current = { isOnline: false, isConnected: false, connectionType: null, forceCheck: async () => true };
  return {
    useNetwork: () => current,
    NetworkProvider: ({ children }: any) => children,
    setMockNetwork: (v: any) => {
      current = v;
    },
  };
});

// Mock sync module with factory that returns a jest mock function
jest.mock('../../services/sync', () => ({
  syncPendingInvoices: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
}));

import { SyncProvider, useSyncContext } from '../SyncContext';

function TestChild() {
  const { isSyncing, lastSyncAt } = useSyncContext();
  return (
    <>
      <Text testID="syncing">{isSyncing ? '1' : '0'}</Text>
      <Text testID="lastSyncAt">{lastSyncAt ?? 'null'}</Text>
    </>
  );
}

describe('SyncContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // reset mock network to offline by default
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const net = require('../NetworkContext');
    net.setMockNetwork({ isOnline: false, isConnected: false, connectionType: null, forceCheck: async () => true });
  });

  it('auto-syncs when network transitions from offline to online', async () => {
    // start offline
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const net = require('../NetworkContext');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sync = require('../../services/sync');
    
    net.setMockNetwork({ isOnline: false, isConnected: false, connectionType: null, forceCheck: async () => true });
    sync.syncPendingInvoices.mockResolvedValue({ synced: 2, failed: 0 });

    const { getByTestId, rerender } = render(
      <SyncProvider>
        <TestChild />
      </SyncProvider>
    );

    expect(getByTestId('syncing').props.children).toBe('0');
    expect(getByTestId('lastSyncAt').props.children).toBe('null');

    // go online
    net.setMockNetwork({ isOnline: true, isConnected: true, connectionType: 'wifi', forceCheck: async () => true });

    // re-render provider so effect sees the change
    rerender(
      <SyncProvider>
        <TestChild />
      </SyncProvider>
    );

    await waitFor(() => expect(sync.syncPendingInvoices).toHaveBeenCalled(), { timeout: 3000 });

    await waitFor(() => expect(getByTestId('syncing').props.children).toBe('0'), { timeout: 3000 });
    // lastSyncAt should be set (not null)
    await waitFor(() => expect(getByTestId('lastSyncAt').props.children).not.toBe('null'), { timeout: 3000 });
  }, 10000);
});
