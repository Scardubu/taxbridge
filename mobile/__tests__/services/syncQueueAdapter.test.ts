/**
 * Sync Queue Adapter Unit Tests
 *
 * Tests the processQueueSync orchestration logic that bridges
 * the local sync queue with the backend device-sync API.
 */

// Mock expo-sqlite to throw so the module falls back to AsyncStorage
jest.mock('expo-sqlite', () => {
  throw new Error('expo-sqlite not available in test');
});

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the deviceSync API calls
const mockSendHeartbeat = jest.fn().mockResolvedValue({ success: true, pendingJobs: 0 });
const mockSyncPush = jest.fn().mockResolvedValue({ synced: [], conflicts: [], failed: [] });
const mockSyncPull = jest.fn().mockResolvedValue({ success: true, invoices: [], hasMore: false, timestamp: new Date().toISOString() });

jest.mock('../../src/services/deviceSync', () => ({
  sendHeartbeat: (...args: any[]) => mockSendHeartbeat(...args),
  syncPush: (...args: any[]) => mockSyncPush(...args),
  syncPull: (...args: any[]) => mockSyncPull(...args),
}));

// Mock markInvoiceSynced from database
const mockMarkInvoiceSynced = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/database', () => ({
  markInvoiceSynced: (...args: any[]) => mockMarkInvoiceSynced(...args),
}));

import { processQueueSync } from '../../src/services/syncQueueAdapter';
import { enqueueSyncQueueItem, getSyncQueueCount, clearSyncQueue } from '../../src/services/syncQueue';

describe('syncQueueAdapter', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.clearAllMocks();
    mockSendHeartbeat.mockResolvedValue({ success: true, pendingJobs: 0 });
    mockSyncPush.mockResolvedValue({ synced: [], conflicts: [], failed: [] });
    mockSyncPull.mockResolvedValue({ success: true, invoices: [], hasMore: false, timestamp: new Date().toISOString() });
  });

  describe('processQueueSync', () => {
    it('should return zero counts when queue is empty', async () => {
      const result = await processQueueSync();

      expect(result).toEqual({ synced: 0, failed: 0, deferred: 0, conflicts: 0 });
      expect(mockSendHeartbeat).toHaveBeenCalledTimes(1);
      expect(mockSyncPush).not.toHaveBeenCalled();
      expect(mockSyncPull).toHaveBeenCalledTimes(1);
    });

    it('should push pending items and count synced results', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1', total: 1000 },
      });

      mockSyncPush.mockResolvedValue({
        synced: ['inv-1'],
        conflicts: [],
        failed: [],
      });

      const result = await processQueueSync();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(mockSyncPush).toHaveBeenCalledTimes(1);
      expect(mockMarkInvoiceSynced).toHaveBeenCalledWith({
        id: 'inv-1',
        serverId: 'inv-1',
        status: 'queued',
      });

      // Item should be removed from queue after successful sync
      const remaining = await getSyncQueueCount();
      expect(remaining).toBe(0);
    });

    it('should count conflicts from push response', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-conflict' },
      });

      mockSyncPush.mockResolvedValue({
        synced: [],
        conflicts: ['inv-conflict'],
        failed: [],
      });

      const result = await processQueueSync();

      expect(result.conflicts).toBe(1);
      expect(result.synced).toBe(0);
    });

    it('should defer failed items with retry metadata', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-fail' },
      });

      mockSyncPush.mockResolvedValue({
        synced: [],
        conflicts: [],
        failed: ['inv-fail'],
      });

      const result = await processQueueSync();

      expect(result.deferred).toBe(1);
      expect(result.failed).toBe(0); // Only permanently failed (5+ attempts) count as failed

      // Item should still be in queue with updated retry metadata
      const remaining = await getSyncQueueCount();
      expect(remaining).toBe(1);
    });

    it('should continue when heartbeat fails', async () => {
      mockSendHeartbeat.mockRejectedValue(new Error('Network error'));

      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });

      mockSyncPush.mockResolvedValue({
        synced: ['inv-1'],
        conflicts: [],
        failed: [],
      });

      const result = await processQueueSync();

      // Should still process the queue despite heartbeat failure
      expect(result.synced).toBe(1);
      expect(mockSyncPush).toHaveBeenCalledTimes(1);
    });

    it('should continue when pull fails', async () => {
      mockSyncPull.mockRejectedValue(new Error('Pull failed'));

      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });

      mockSyncPush.mockResolvedValue({
        synced: ['inv-1'],
        conflicts: [],
        failed: [],
      });

      const result = await processQueueSync();

      // Push results should still be valid
      expect(result.synced).toBe(1);
    });

    it('should defer unsupported entity types', async () => {
      await enqueueSyncQueueItem({
        entity: 'expense' as any,
        action: 'create',
        payload: { id: 'exp-1' },
      });

      const result = await processQueueSync();

      expect(result.deferred).toBe(1);
      expect(result.synced).toBe(0);
      expect(mockSyncPush).not.toHaveBeenCalled(); // Only invoice items trigger push
    });

    it('should handle batch network failure gracefully', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-2' },
      });

      mockSyncPush.mockRejectedValue(new Error('Connection refused'));

      const result = await processQueueSync();

      // All items should be deferred, not lost
      expect(result.deferred).toBe(2);
      expect(result.failed).toBe(0);

      // Items should still be in queue
      const remaining = await getSyncQueueCount();
      expect(remaining).toBe(2);
    });

    it('should process mixed entity batches correctly', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });
      await enqueueSyncQueueItem({
        entity: 'expense' as any,
        action: 'create',
        payload: { id: 'exp-1' },
      });

      mockSyncPush.mockResolvedValue({
        synced: ['inv-1'],
        conflicts: [],
        failed: [],
      });

      const result = await processQueueSync();

      expect(result.synced).toBe(1); // invoice synced
      expect(result.deferred).toBe(1); // expense deferred (unsupported)
    });
  });
});
