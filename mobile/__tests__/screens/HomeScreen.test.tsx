// __tests__/screens/HomeScreen.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';

jest.mock('../../src/components/ui/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'SkeletonLoader');
  },
}));

jest.mock('../../src/components/SyncStatusBar', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});
jest.mock('../../src/components/QuickActionRail', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});
jest.mock('../../src/components/InsightsCarousel', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});
jest.mock('../../src/components/header', () => ({
  LivingBridgeHeader: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, null);
  },
}));
jest.mock('../../src/components/FloatingActionButton', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});
jest.mock('../../src/components/GlobalSearch', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});
jest.mock('../../src/components/SyncQueueViewer', () => () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, null, null);
});

jest.mock('../../src/contexts/SyncContext', () => ({
  useSyncContext: () => ({
    manualSync: jest.fn(),
    lastSyncAt: null,
    isSyncing: false,
    conflictCount: 0,
    lastError: null,
    progress: null,
    retrySync: jest.fn(),
    syncState: 'IDLE',
  }),
  useSync: () => ({
    manualSync: jest.fn(),
    lastSyncAt: null,
    isSyncing: false,
    conflictCount: 0,
    lastError: null,
    progress: null,
    retrySync: jest.fn(),
    syncState: 'IDLE',
  }),
}));

jest.mock('../../src/contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../src/contexts/FeatureFlagContext', () => ({
  useFeatureFlag: () => false,
}));

jest.mock('../../src/services/database', () => ({
  getInvoices: jest.fn().mockResolvedValue([]),
}));

const mockNavigation = {
  navigate: jest.fn(),
};

describe('HomeScreen', () => {
  it('should display stats when invoices exist', async () => {
    require('../../src/services/database').getInvoices.mockResolvedValue([
      {
        id: 'inv-1',
        synced: 1,
        items: JSON.stringify([{ quantity: 2, unitPrice: 100 }]),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const { getByText, queryByText } = render(<HomeScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText('home.invoicesLabel')).toBeTruthy();
      expect(queryByText('home.noInvoicesTitle')).toBeNull();
    });
  });

  it('should show empty state when no invoices', async () => {
    require('../../src/services/database').getInvoices.mockResolvedValue([]);
    
    const { getByText } = render(<HomeScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText('home.noInvoicesTitle')).toBeTruthy();
    });
  });
});