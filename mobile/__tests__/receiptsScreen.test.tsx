import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import ReceiptsScreen from '../app/(tabs)/receipts';

const mockUseCameraPermissions = jest.fn();
const mockRequestPermission = jest.fn();
let mockOnboardingDone = false;

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef((_props: object, _ref: unknown) => React.createElement('CameraView')),
    useCameraPermissions: () => mockUseCameraPermissions(),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success' },
}));

jest.mock('../stores/onboardingStore', () => ({
  useIsOnboardingDone: () => mockOnboardingDone,
}));

jest.mock('../stores/businessProfileStore', () => ({
  useBusinessProfileStore: jest.fn((selector: (state: { businessId: string | null }) => unknown) => selector({ businessId: 'biz-123' })),
}));

jest.mock('../stores/receiptStore', () => ({
  useReceiptStore: jest.fn((selector: (state: { addReceipt: jest.Mock }) => unknown) => selector({ addReceipt: jest.fn() })),
}));

jest.mock('../services/receiptOcr', () => ({
  processReceiptImage: jest.fn(),
}));

jest.mock('../services/receiptService', () => ({
  DuplicateReceiptError: class DuplicateReceiptError extends Error {},
  RECEIPT_FALLBACK_BUSINESS_ID: 'local-business',
  receiptService: {
    saveReceipt: jest.fn(),
  },
}));

describe('ReceiptsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnboardingDone = false;
    mockUseCameraPermissions.mockReturnValue([{ granted: false }, mockRequestPermission]);
  });

  test('locks receipt scanning until onboarding is complete', () => {
    const screen = render(<ReceiptsScreen />);

    expect(screen.getByText('receipts.title')).toBeTruthy();
    expect(screen.getByText('receipts.emptyBody')).toBeTruthy();

    fireEvent.press(screen.getByText(/onboarding.getStarted/));

    expect(router.push).toHaveBeenCalledWith('/(onboarding)/business-type');
  });

  test('requests camera permission after onboarding is complete', () => {
    mockOnboardingDone = true;
    mockUseCameraPermissions.mockReturnValue([{ granted: false }, mockRequestPermission]);

    const screen = render(<ReceiptsScreen />);

    fireEvent.press(screen.getByText('receipts.enableCamera'));

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});
