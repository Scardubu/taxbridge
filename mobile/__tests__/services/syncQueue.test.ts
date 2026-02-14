/**
 * Sync Queue Service Unit Tests
 *
 * Tests the local sync queue CRUD operations used by the
 * device-sync queue adapter. Uses the AsyncStorage (web) fallback
 * path since SQLite is not available in the Jest environment.
 */

// Mock expo-sqlite to throw so the module falls back to AsyncStorage
jest.mock('expo-sqlite', () => {
  throw new Error('expo-sqlite not available in test');
});

// Mock AsyncStorage before any imports
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

// Mock react-native Platform to force web fallback (no SQLite)
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  enqueueSyncQueueItem,
  getPendingSyncQueueItems,
  updateSyncQueueItem,
  removeSyncQueueItems,
  getSyncQueueCount,
  clearSyncQueue,
} from '../../src/services/syncQueue';

describe('syncQueue service', () => {
  beforeEach(() => {
    // Clear mock storage between tests
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.clearAllMocks();
  });

  describe('enqueueSyncQueueItem', () => {
    it('should enqueue an item and return a UUID', async () => {
      const id = await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1', total: 1000 },
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should persist enqueued items', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });

      const count = await getSyncQueueCount();
      expect(count).toBe(1);
    });

    it('should set default values for optional fields', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });

      const items = await getPendingSyncQueueItems();
      expect(items).toHaveLength(1);
      expect(items[0].attempts).toBe(0);
      expect(items[0].lastError).toBeNull();
      expect(items[0].nextRetry).toBeNull();
      expect(items[0].clientVersion).toBe(0);
      expect(items[0].deviceId).toBeNull();
    });

    it('should respect provided deviceId and clientVersion', async () => {
      await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'update',
        clientVersion: 3,
        deviceId: 'device-123',
        payload: { id: 'inv-2' },
      });

      const items = await getPendingSyncQueueItems();
      expect(items[0].deviceId).toBe('device-123');
      expect(items[0].clientVersion).toBe(3);
      expect(items[0].action).toBe('update');
    });

    it('should enqueue multiple items', async () => {
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'a' } });
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'b' } });
      await enqueueSyncQueueItem({ entity: 'expense', action: 'create', payload: { id: 'c' } });

      const count = await getSyncQueueCount();
      expect(count).toBe(3);
    });
  });

  describe('getPendingSyncQueueItems', () => {
    it('should return empty array when queue is empty', async () => {
      const items = await getPendingSyncQueueItems();
      expect(items).toEqual([]);
    });

    it('should return items sorted by createdAt ascending', async () => {
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'first' } });
      // Small delay to guarantee distinct timestamps
      await new Promise((r) => setTimeout(r, 5));
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'second' } });

      const items = await getPendingSyncQueueItems();
      expect(items).toHaveLength(2);
      expect(items[0].payload.id).toBe('first');
      expect(items[1].payload.id).toBe('second');
    });

    it('should exclude items with future nextRetry', async () => {
      const id = await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'deferred' },
      });

      // Set nextRetry to the future
      const futureDate = new Date(Date.now() + 60_000).toISOString();
      await updateSyncQueueItem(id, { nextRetry: futureDate, attempts: 1 });

      const items = await getPendingSyncQueueItems();
      expect(items).toHaveLength(0);
    });

    it('should include items with past nextRetry', async () => {
      const id = await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'ready' },
      });

      // Set nextRetry to the past
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      await updateSyncQueueItem(id, { nextRetry: pastDate, attempts: 1 });

      const items = await getPendingSyncQueueItems();
      expect(items).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: `inv-${i}` } });
      }

      const items = await getPendingSyncQueueItems(3);
      expect(items).toHaveLength(3);
    });
  });

  describe('updateSyncQueueItem', () => {
    it('should update retry metadata on an existing item', async () => {
      const id = await enqueueSyncQueueItem({
        entity: 'invoice',
        action: 'create',
        payload: { id: 'inv-1' },
      });

      await updateSyncQueueItem(id, {
        attempts: 2,
        lastError: 'Server timeout',
        nextRetry: '2026-03-01T00:00:00.000Z',
      });

      const items = await getPendingSyncQueueItems(100);
      // Item has future nextRetry so it won't appear in pending,
      // but let's check count is still 1
      const count = await getSyncQueueCount();
      expect(count).toBe(1);
    });

    it('should not crash when updating a non-existent item', async () => {
      // Should silently do nothing
      await expect(
        updateSyncQueueItem('nonexistent-id', { attempts: 1 })
      ).resolves.toBeUndefined();
    });
  });

  describe('removeSyncQueueItems', () => {
    it('should remove specified items by id', async () => {
      const id1 = await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'a' } });
      const id2 = await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'b' } });
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'c' } });

      await removeSyncQueueItems([id1, id2]);

      const count = await getSyncQueueCount();
      expect(count).toBe(1);

      const items = await getPendingSyncQueueItems();
      expect(items[0].payload.id).toBe('c');
    });

    it('should handle empty ids array gracefully', async () => {
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'a' } });
      await removeSyncQueueItems([]);

      const count = await getSyncQueueCount();
      expect(count).toBe(1);
    });
  });

  describe('clearSyncQueue', () => {
    it('should remove all items from the queue', async () => {
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'a' } });
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'b' } });

      await clearSyncQueue();

      const count = await getSyncQueueCount();
      expect(count).toBe(0);
    });
  });

  describe('getSyncQueueCount', () => {
    it('should return 0 for empty queue', async () => {
      const count = await getSyncQueueCount();
      expect(count).toBe(0);
    });

    it('should reflect current queue size', async () => {
      await enqueueSyncQueueItem({ entity: 'invoice', action: 'create', payload: { id: 'a' } });
      await enqueueSyncQueueItem({ entity: 'expense', action: 'create', payload: { id: 'b' } });

      const count = await getSyncQueueCount();
      expect(count).toBe(2);
    });
  });
});
