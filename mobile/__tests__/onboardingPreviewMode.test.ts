const mockSetPreviewModeFlag = jest.fn((value: boolean) => Promise.resolve(value));
const mockClearPreviewModeFlag = jest.fn(() => Promise.resolve());
const mockLogComplianceEvent = jest.fn((event: string, message?: string, severity?: string, meta?: Record<string, unknown>) =>
  Promise.resolve({ event, message, severity, meta })
);
const mockReplace = jest.fn();

jest.mock('../storage/kv', () => ({
  AppKV: {
    onboarding: {
      setStep: jest.fn(),
      setComplete: jest.fn(),
    },
    flags: {
      setPreviewMode: (value: boolean) => mockSetPreviewModeFlag(value),
      getPreviewMode: jest.fn(() => Promise.resolve(false)),
      clearPreviewMode: () => mockClearPreviewModeFlag(),
      setStoreReady: jest.fn(() => Promise.resolve()),
    },
  },
  zustandKvStorage: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../services/api', () => ({
  apiRequest: jest.fn(() => Promise.resolve(undefined)),
}));

jest.mock('../services/complianceEventService', () => ({
  logComplianceEvent: (...args: [string, string?, string?, Record<string, unknown>?]) => mockLogComplianceEvent(...args),
}));

jest.mock('../services/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve({ runAsync: jest.fn() })),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

import { useOnboardingStore } from '../stores/onboardingStore';

describe('onboarding preview mode', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      currentStepId: 'community',
      completedSteps: ['welcome', 'business-type', 'tin-verify', 'vat-setup', 'einvoice'],
      isComplete: false,
      previewMode: true,
      _hasHydrated: true,
      isSyncing: false,
      schemaVersion: 13,
    });
  });

  test('setPreviewMode updates store immediately', () => {
    useOnboardingStore.getState().setPreviewMode(true);

    expect(useOnboardingStore.getState().previewMode).toBe(true);
    expect(mockSetPreviewModeFlag).toHaveBeenCalledWith(true);
  });

  test('complete clears preview mode before navigating to tabs', async () => {
    await useOnboardingStore.getState().complete();

    expect(useOnboardingStore.getState().previewMode).toBe(false);
    expect(mockClearPreviewModeFlag).toHaveBeenCalled();
    expect(mockLogComplianceEvent).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
