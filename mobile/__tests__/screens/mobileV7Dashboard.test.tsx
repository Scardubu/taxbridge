import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import mockEn from '../../i18n/en.json';
import mockPidgin from '../../i18n/pidgin.json';
import DashboardTab from '../../app/(tabs)/index';

type TestNudge = {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  priority: 'critical' | 'warning' | 'opportunity';
  actionLabel: string;
  route: string;
  external?: boolean;
};

const mockComputeObligations = jest.fn();
const mockGenerateNudges = jest.fn((_profile: unknown, _obligations: unknown): TestNudge[] => []);
const mockGetAlerts = jest.fn(() => Promise.resolve([]));
const mockLogComplianceEvent = jest.fn(() => Promise.resolve(undefined));
const mockMarkPaymentConfirmed = jest.fn(() => Promise.resolve(undefined));
const mockHydrate = jest.fn(() => Promise.resolve(undefined));
const mockUpdateField = jest.fn();
const mockRouterPush = jest.fn();
const mockRegisteredHandlers = new Map<string, (payload: Record<string, unknown>) => void>();

let mockAccessToken: string | null = null;
let mockCurrentLanguage: 'en' | 'pidgin' = 'en';
let mockPreviewMode = true;
let mockOnboardingDone = false;
let mockEventNudges: Array<{
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  priority: 'critical' | 'warning' | 'opportunity';
  actionLabel: string;
  route: string;
  external?: boolean;
  source: 'admin' | 'system';
}> = [];
let mockBusinessState = {
  businessName: '',
  annualTurnover: null,
  totalFixedAssets: null,
  sector: '',
  businessType: '',
  isVatRegistered: false,
  hasValidTIN: false,
  monthlyRevenue: null,
  isHydrated: true,
  hydrate: mockHydrate,
  updateField: mockUpdateField,
};

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

const useBusinessProfileStoreMock = ((selector: (state: typeof mockBusinessState) => unknown) =>
  selector(mockBusinessState)) as unknown as {
  (selector: (state: typeof mockBusinessState) => unknown): unknown;
  getState: () => typeof mockBusinessState;
};
useBusinessProfileStoreMock.getState = () => mockBusinessState;

const useNudgeStoreMock = ((selector: (state: {
  eventNudges: typeof mockEventNudges;
  prependNudge: (nudge: (typeof mockEventNudges)[number]) => void;
  dismissNudge: (id: string) => void;
  clearEventNudges: () => void;
}) => unknown) =>
  selector({
    eventNudges: mockEventNudges,
    prependNudge: (nudge) => {
      mockEventNudges = [nudge, ...mockEventNudges.filter((existing) => existing.id !== nudge.id)];
    },
    dismissNudge: (id) => {
      mockEventNudges = mockEventNudges.filter((nudge) => nudge.id !== id);
    },
    clearEventNudges: () => {
      mockEventNudges = [];
    },
  })) as unknown as {
  (selector: (state: {
    eventNudges: typeof mockEventNudges;
    prependNudge: (nudge: (typeof mockEventNudges)[number]) => void;
    dismissNudge: (id: string) => void;
    clearEventNudges: () => void;
  }) => unknown): unknown;
  getState: () => {
    eventNudges: typeof mockEventNudges;
    prependNudge: (nudge: (typeof mockEventNudges)[number]) => void;
    dismissNudge: (id: string) => void;
    clearEventNudges: () => void;
  };
};
useNudgeStoreMock.getState = () => ({
  eventNudges: mockEventNudges,
  prependNudge: (nudge) => {
    mockEventNudges = [nudge, ...mockEventNudges.filter((existing) => existing.id !== nudge.id)];
  },
  dismissNudge: (id) => {
    mockEventNudges = mockEventNudges.filter((nudge) => nudge.id !== id);
  },
  clearEventNudges: () => {
    mockEventNudges = [];
  },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      mockResolveTranslation(mockCurrentLanguage === 'pidgin' ? mockPidgin as Record<string, unknown> : mockEn as Record<string, unknown>, key, values),
    i18n: {
      language: mockCurrentLanguage,
      resolvedLanguage: mockCurrentLanguage,
      changeLanguage: jest.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('../../stores/onboardingStore', () => ({
  useOnboardingStore: (selector: (state: { previewMode: boolean }) => unknown) => selector({ previewMode: mockPreviewMode }),
  useIsOnboardingDone: () => mockOnboardingDone,
  useCurrentStepId: () => 'welcome',
  STEP_ROUTES: {
    welcome: '/(onboarding)',
    'business-type': '/(onboarding)/business-type',
    'tin-verify': '/(onboarding)/tin-verify',
    'vat-setup': '/(onboarding)/vat-setup',
    einvoice: '/(onboarding)/einvoice',
    community: '/(onboarding)/community',
  },
}));

jest.mock('../../stores/businessProfileStore', () => ({
  useBusinessProfileStore: useBusinessProfileStoreMock,
}));

jest.mock('../../stores/nudgeStore', () => ({
  useNudgeStore: useNudgeStoreMock,
}));

jest.mock('../../services/nrsCompliance', () => ({
  computeObligations: (...args: unknown[]) => mockComputeObligations(...args),
  TAX_AUTHORITY: { portalUrl: 'https://einvoice.firs.gov.ng' },
}));

jest.mock('../../services/nudgeEngine', () => ({
  generateNudges: (profile: unknown, obligations: unknown) => mockGenerateNudges(profile, obligations),
}));

jest.mock('../../services/offlineQueue', () => ({
  offlineQueue: { flush: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../services/api', () => ({
  getAlerts: () => mockGetAlerts(),
}));

jest.mock('../../services/complianceEventService', () => ({
  logComplianceEvent: (type: string, description: string, severity: string, metadata?: Record<string, unknown>, context?: Record<string, unknown>) =>
    mockLogComplianceEvent(type, description, severity, metadata, context),
}));

jest.mock('../../services/paymentService', () => ({
  markPaymentConfirmed: (remitaRrr: string) => mockMarkPaymentConfirmed(remitaRrr),
}));

jest.mock('../../components/TaxShieldRing', () => ({
  TaxShieldRing: ({ score }: { score: number }) => require('react').createElement('Text', null, `ring:${score}`),
}));

jest.mock('../../components/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

jest.mock('../../components/OnboardingProgressBanner', () => ({
  OnboardingProgressBanner: ({ onContinue }: { onContinue: () => void }) => {
    const React = require('react');
    const { Text, Pressable } = require('react-native');
    const { useTranslation } = require('react-i18next');
    const { t } = useTranslation();
    return React.createElement(
      Pressable,
      { onPress: onContinue, accessibilityLabel: 'continue-banner' },
      React.createElement(Text, null, t('dashboard.bannerBody')),
      React.createElement(Text, null, t('dashboard.bannerCta')),
    );
  },
}));

jest.mock('../../services/tokenService', () => ({
  TokenService: {
    getAccessToken: jest.fn(() => Promise.resolve(mockAccessToken)),
    setAccessToken: jest.fn().mockResolvedValue(undefined),
    clearAccessToken: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/sseService', () => ({
  sseService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn((eventName: string, handler: (payload: Record<string, unknown>) => void) => {
      mockRegisteredHandlers.set(eventName, handler);
      return () => mockRegisteredHandlers.delete(eventName);
    }),
  },
}));

describe('mobile v8 dashboard', () => {
  beforeEach(() => {
    mockAccessToken = null;
    mockCurrentLanguage = 'en';
    mockPreviewMode = true;
    mockOnboardingDone = false;
    mockEventNudges = [];
    mockRegisteredHandlers.clear();
    mockBusinessState = {
      businessName: '',
      annualTurnover: null,
      totalFixedAssets: null,
      sector: '',
      businessType: '',
      isVatRegistered: false,
      hasValidTIN: false,
      monthlyRevenue: null,
      isHydrated: true,
      hydrate: mockHydrate,
      updateField: mockUpdateField,
    };
    mockComputeObligations.mockReturnValue({
      vatRegistrationRequired: false,
      vatFilingRequired: false,
      vatFilingExempt: true,
      citRate: 0,
      citLiability: 0,
      pitLiability: 0,
      whtExemptEligible: false,
      eInvoicingPhase: 'small',
      eInvoicingMandatory: false,
      eInvoicingRequired: false,
      eInvoicingStatus: 'VOLUNTARY',
      eInvoicingDeadline: new Date('2027-07-01'),
      complianceScore: 60,
      annualTaxBurden: 0,
    });
    mockGenerateNudges.mockReturnValue([]);
    mockGetAlerts.mockResolvedValue([]);
    mockHydrate.mockClear();
    mockUpdateField.mockClear();
    mockLogComplianceEvent.mockClear();
    mockMarkPaymentConfirmed.mockClear();
    mockRouterPush.mockClear();
    (Linking.openURL as jest.Mock).mockClear();
  });

  test('renders preview mode with a zero score and neutral shield copy', () => {
    const screen = render(<DashboardTab />);

    expect(screen.getByText(mockEn.dashboard.bannerBody)).toBeTruthy();
    expect(screen.getByText(mockEn.shield.none)).toBeTruthy();
    expect(screen.getByText(mockEn.compliance.getStarted)).toBeTruthy();
    expect(screen.getAllByText('🚀').length).toBeGreaterThan(0);
    expect(screen.getByText('ring:0')).toBeTruthy();
    expect(screen.queryByText(mockEn.compliance.excellent)).toBeNull();
  });

  test('renders pidgin copy when pidgin is active', () => {
    mockCurrentLanguage = 'pidgin';

    const screen = render(<DashboardTab />);

    expect(screen.getByText(mockPidgin.dashboard.bannerBody)).toBeTruthy();
    expect(screen.getByText(mockPidgin.shield.none)).toBeTruthy();
    expect(screen.getByText(mockPidgin.compliance.getStarted)).toBeTruthy();
  });

  test('renders a fully protected state for high scores', () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;
    mockBusinessState = {
      ...mockBusinessState,
      businessName: 'Chukwu Logistics Ltd',
      businessType: 'limited_company',
    };
    mockComputeObligations.mockReturnValue({
      vatRegistrationRequired: true,
      vatFilingRequired: true,
      vatFilingExempt: false,
      citRate: 0.2,
      citLiability: 100,
      pitLiability: 0,
      whtExemptEligible: false,
      eInvoicingPhase: 'medium',
      eInvoicingMandatory: true,
      eInvoicingRequired: true,
      eInvoicingStatus: 'ENFORCEMENT_ACTIVE',
      eInvoicingDeadline: new Date('2026-07-01'),
      complianceScore: 85,
      annualTaxBurden: 100,
    });

    const screen = render(<DashboardTab />);

    expect(screen.getByText('Chukwu Logistics Ltd')).toBeTruthy();
    expect(screen.getByText(mockEn.shield.fullyProtected)).toBeTruthy();
    expect(screen.getByText(mockEn.compliance.excellent)).toBeTruthy();
    expect(screen.getByText('🏆')).toBeTruthy();
    expect(screen.getByText('ring:85')).toBeTruthy();
  });

  test('hydrates business profile when tin_verified SSE fires', async () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;
    mockAccessToken = 'token';

    render(<DashboardTab />);

    await waitFor(() => expect(mockRegisteredHandlers.has('tin_verified')).toBe(true));

    await act(async () => {
      mockRegisteredHandlers.get('tin_verified')?.({});
    });

    expect(mockHydrate).toHaveBeenCalled();
  });

  test('prepends admin alert nudges from SSE and logs the event', async () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;
    mockAccessToken = 'token';

    render(<DashboardTab />);

    await waitFor(() => expect(mockRegisteredHandlers.has('admin_alert')).toBe(true));

    await act(async () => {
      mockRegisteredHandlers.get('admin_alert')?.({
        id: 'evt-1',
        message: 'Urgent compliance review required',
        severity: 'critical',
        action_url: 'https://einvoice.firs.gov.ng',
      });
    });

    expect(useNudgeStoreMock.getState().eventNudges[0]).toMatchObject({
      id: 'evt-1',
      body: 'Urgent compliance review required',
      priority: 'critical',
      route: 'https://einvoice.firs.gov.ng',
      source: 'admin',
    });
    expect(mockLogComplianceEvent).toHaveBeenCalled();
  });

  test('renders event nudges ahead of generated nudges and opens external routes', () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;
    mockEventNudges = [
      {
        id: 'admin-alert-1',
        title: 'Admin alert',
        body: 'Review your e-invoice setup',
        severity: 'critical',
        priority: 'critical',
        actionLabel: 'Open details',
        route: 'https://einvoice.firs.gov.ng',
        external: true,
        source: 'admin',
      },
    ];
    mockGenerateNudges.mockReturnValue([
      {
        id: 'missing-tin',
        title: 'Verify your TIN',
        body: 'Body',
        severity: 'critical' as const,
        priority: 'critical' as const,
        actionLabel: 'Verify',
        route: '/(tabs)/compliance',
      },
    ]);

    const screen = render(<DashboardTab />);

    expect(screen.getByText('Review your e-invoice setup')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Admin alert'));

    expect(Linking.openURL).toHaveBeenCalledWith('https://einvoice.firs.gov.ng');
  });

  test('marks payments confirmed when payment_confirmed SSE fires', async () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;
    mockAccessToken = 'token';

    render(<DashboardTab />);

    await waitFor(() => expect(mockRegisteredHandlers.has('payment_confirmed')).toBe(true));

    await act(async () => {
      mockRegisteredHandlers.get('payment_confirmed')?.({ remita_rrr: '220000111' });
    });

    expect(mockMarkPaymentConfirmed).toHaveBeenCalledWith('220000111');
    expect(mockHydrate).toHaveBeenCalled();
  });
});
