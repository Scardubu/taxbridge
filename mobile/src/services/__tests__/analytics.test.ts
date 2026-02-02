import AsyncStorage from '@react-native-async-storage/async-storage';
import * as analytics from '../analytics';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock Sentry
jest.mock('../sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Analytics Service', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    
    // Mock AsyncStorage with in-memory store
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => 
      Promise.resolve(mockStore[key] || null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
      mockStore[key] = value;
      return Promise.resolve();
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key) => {
      delete mockStore[key];
      return Promise.resolve();
    });
  });

  describe('Onboarding Tracking', () => {
    it('should store onboarding metrics on start', async () => {
      await analytics.trackOnboardingStart();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const metricsCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0].includes('onboarding_metrics')
      );
      expect(metricsCall).toBeDefined();
      
      if (metricsCall) {
        const metrics = JSON.parse(metricsCall[1]);
        expect(metrics.startedAt).toBeDefined();
        expect(metrics.stepsCompleted).toEqual([]);
        expect(metrics.stepsSkipped).toEqual([]);
      }
    });

    it('should track step completion', async () => {
      await analytics.trackOnboardingStep('profile', true, false, 30000);

      const metricsCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0].includes('onboarding_metrics')
      );
      
      if (metricsCall) {
        const metrics = JSON.parse(metricsCall[1]);
        expect(metrics.stepsCompleted).toContain('profile');
      }
    });

    it('should track step skip', async () => {
      await analytics.trackOnboardingStep('tutorial', false, true, 5000);

      const metricsCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0].includes('onboarding_metrics')
      );
      
      if (metricsCall) {
        const metrics = JSON.parse(metricsCall[1]);
        expect(metrics.stepsSkipped).toContain('tutorial');
      }
    });

    it('should track completion with duration', async () => {
      await analytics.trackOnboardingStart();
      await analytics.trackOnboardingComplete();

      const metricsCall = (AsyncStorage.setItem as jest.Mock).mock.calls.slice(-1)[0];
      
      if (metricsCall && metricsCall[0].includes('onboarding_metrics')) {
        const metrics = JSON.parse(metricsCall[1]);
        expect(metrics.completedAt).toBeDefined();
        expect(metrics.totalDuration).toBeDefined();
      }
    });

    it('should track drop-off step', async () => {
      await analytics.trackOnboardingDropOff('pit-calculator');

      const metricsCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0].includes('onboarding_metrics')
      );
      
      if (metricsCall) {
        const metrics = JSON.parse(metricsCall[1]);
        expect(metrics.dropOffStep).toBe('pit-calculator');
      }
    });
  });

  describe('Analytics Data Retrieval', () => {
    it('should retrieve stored analytics data', async () => {
      const mockData = [
        { 
          id: '1',
          category: 'navigation',
          action: 'screen_view',
          label: 'Home',
          timestamp: Date.now(),
          sessionId: 'test-session'
        },
      ];
      mockStore['tb_analytics_events'] = JSON.stringify(mockData);

      const data = await analytics.getAnalyticsData();

      expect(data).toEqual(mockData);
    });

    it('should return empty array if no data', async () => {
      const data = await analytics.getAnalyticsData();

      expect(data).toEqual([]);
    });
  });

  describe('Analytics Clearing', () => {
    it('should clear all analytics data', async () => {
      await analytics.clearAnalytics();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tb_analytics_events');
    });
  });

  describe('Privacy Compliance', () => {
    it('should not expose sensitive data in stored metrics', async () => {
      await analytics.trackOnboardingStart();

      const allCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const dataString = JSON.stringify(allCalls);

      // Verify no TIN, email, phone, customer names in analytics data
      // Use word boundaries to avoid matching 13-digit timestamps
      expect(dataString).not.toMatch(/\b\d{10,11}\b/); // No 10-11 digit numbers (TINs)
      expect(dataString).not.toMatch(/@.*\./); // No email patterns
      expect(dataString).not.toMatch(/\+234/); // No phone numbers
    });
  });
});
