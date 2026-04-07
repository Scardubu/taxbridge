import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import mockEn from '../../i18n/en.json';
import { OfflineIndicator } from '../../components/OfflineIndicator';

const mockFlush = jest.fn(() => Promise.resolve(undefined));
const mockGetPendingCount = jest.fn(() => Promise.resolve(0));
let netInfoListener: ((state: { isConnected: boolean | null }) => void) | null = null;

function mockResolveTranslation(source: Record<string, unknown>, key: string, values?: Record<string, unknown>) {
  const resolved = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);

  if (typeof resolved !== 'string') {
    return key;
  }

  return resolved.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token) => String(values?.[token] ?? ''));
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => mockResolveTranslation(mockEn as Record<string, unknown>, key, values),
    i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: jest.fn() },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (listener: (state: { isConnected: boolean | null }) => void) => {
    netInfoListener = listener;
    listener({ isConnected: true });
    return jest.fn();
  },
}));

jest.mock('../../services/offlineQueue', () => ({
  offlineQueue: {
    flush: () => mockFlush(),
    getPendingCount: () => mockGetPendingCount(),
  },
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    netInfoListener = null;
    mockFlush.mockClear();
    mockGetPendingCount.mockReset();
    mockGetPendingCount.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('stays hidden when online and queue is empty', async () => {
    const screen = render(<OfflineIndicator />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(mockEn.offline.syncNow)).toBeNull();
    expect(screen.queryByText(/operations syncing/i)).toBeNull();
  });

  test('shows queued operations message while offline', async () => {
    mockGetPendingCount.mockResolvedValue(2);
    const screen = render(<OfflineIndicator />);

    await act(async () => {
      netInfoListener?.({ isConnected: false });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("You're offline. 2 operations queued.")).toBeTruthy();
    });
  });

  test('shows sync-now action when online with queued operations and flushes on press', async () => {
    mockGetPendingCount.mockResolvedValue(3);
    const screen = render(<OfflineIndicator />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('3 operations syncing...')).toBeTruthy();
      expect(screen.getByText(mockEn.offline.syncNow)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText(mockEn.offline.syncNow));
      await Promise.resolve();
    });

    expect(mockFlush).toHaveBeenCalled();
  });
});