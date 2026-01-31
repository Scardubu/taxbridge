import React from 'react';
import { render } from '@testing-library/react-native';
import DashboardScreen from '../../src/screens/DashboardScreen';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('../../src/contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../src/contexts/SyncContext', () => ({
  useSyncContext: () => ({ manualSync: jest.fn(), lastSyncAt: null }),
}));

jest.mock('../../src/contexts/FeatureFlagContext', () => ({
  useFeatureFlag: () => false,
}));

jest.mock('../../src/services/database', () => ({
  getInvoices: jest.fn().mockResolvedValue([]),
}));

describe('DashboardScreen visual tests', () => {
  it('renders with default state', () => {
    const { toJSON } = render(<DashboardScreen navigation={mockNavigation} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
