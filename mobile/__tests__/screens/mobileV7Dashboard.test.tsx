import React from 'react';
import { render } from '@testing-library/react-native';
import mockEn from '../../i18n/en.json';
import mockPidgin from '../../i18n/pidgin.json';
import DashboardTab from '../../app/(tabs)/index';

const mockComputeObligations = jest.fn();
const mockGenerateNudges = jest.fn((_profile: unknown, _obligations: unknown) => []);

let mockCurrentLanguage: 'en' | 'pidgin' = 'en';
let mockPreviewMode = true;
let mockOnboardingDone = false;
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

jest.mock('../../stores/onboardingStore', () => ({
  useOnboardingStore: (selector: (state: { previewMode: boolean }) => unknown) => selector({ previewMode: mockPreviewMode }),
  useIsOnboardingDone: () => mockOnboardingDone,
}));

jest.mock('../../stores/businessProfileStore', () => ({
  useBusinessProfileStore: (selector: (state: typeof mockBusinessState) => unknown) => selector(mockBusinessState),
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

jest.mock('../../components/TaxShieldRing', () => ({
  TaxShieldRing: ({ compliance }: { compliance: number }) => require('react').createElement('Text', null, `ring:${compliance}`),
}));

jest.mock('../../components/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

describe('mobile v7 dashboard', () => {
  beforeEach(() => {
    mockCurrentLanguage = 'en';
    mockPreviewMode = true;
    mockOnboardingDone = false;
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
  });

  test('renders preview mode with a zero score and neutral shield copy', () => {
    const screen = render(<DashboardTab />);

    expect(screen.getByText(mockEn.preview.banner)).toBeTruthy();
    expect(screen.getByText(mockEn.shield.none)).toBeTruthy();
    expect(screen.getByText(mockEn.compliance.getStarted)).toBeTruthy();
    expect(screen.getAllByText('🚀').length).toBeGreaterThan(0);
    expect(screen.getByText('ring:0')).toBeTruthy();
    expect(screen.queryByText(mockEn.compliance.excellent)).toBeNull();
  });

  test('renders pidgin copy when pidgin is active', () => {
    mockCurrentLanguage = 'pidgin';

    const screen = render(<DashboardTab />);

    expect(screen.getByText(mockPidgin.preview.banner)).toBeTruthy();
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
});
