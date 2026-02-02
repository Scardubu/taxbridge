/**
 * SyncContext Smoke Tests
 *
 * Phase F: Test Suite Expansion
 * Simplified smoke tests that verify SyncContext exports without triggering
 * jest-circus + @testing-library/react-native hook registration conflicts.
 */

// Mock all external dependencies
jest.mock('../../services/sync', () => ({
  syncPendingInvoices: jest.fn().mockResolvedValue({ synced: 0, failed: 0, deferred: 0 }),
}));

jest.mock('../../services/deviceSync', () => ({
  performFullSync: jest.fn().mockResolvedValue({ pushed: false, pulled: { invoices: [] } }),
  listConflicts: jest.fn().mockResolvedValue({ conflicts: [] }),
  collectLocalChanges: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/authTokens', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-token'),
}));

jest.mock('../../services/analytics', () => ({
  trackSync: jest.fn(),
}));

jest.mock('../NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true, forceCheck: jest.fn().mockResolvedValue(true) }),
  NetworkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../DeviceContext', () => ({
  useDevice: () => ({
    deviceId: 'test-device-123',
    deviceType: 'android',
    canSync: true,
    deviceState: 'ACTIVE',
    suspensionReason: null,
  }),
  DeviceProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../services/database', () => ({
  getPendingInvoices: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Suppress console noise
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('SyncContext Smoke Tests', () => {
  it('exports SyncProvider component', () => {
    const { SyncProvider } = require('../SyncContext');
    expect(SyncProvider).toBeDefined();
    expect(typeof SyncProvider).toBe('function');
  });

  it('exports useSyncContext hook', () => {
    const { useSyncContext } = require('../SyncContext');
    expect(useSyncContext).toBeDefined();
    expect(typeof useSyncContext).toBe('function');
  });

  it('exports useSync alias hook', () => {
    const { useSync } = require('../SyncContext');
    expect(useSync).toBeDefined();
    expect(typeof useSync).toBe('function');
  });

  it('exports SyncContext', () => {
    const { SyncContext } = require('../SyncContext');
    expect(SyncContext).toBeDefined();
  });
});
