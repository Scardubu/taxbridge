import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
  it('renders with default state', async () => {
    const { toJSON } = render(<DashboardScreen navigation={mockNavigation} />);
    
    // Wait for async data loading to complete
    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
    
    expect(toJSON()).toMatchSnapshot();
  });
});
