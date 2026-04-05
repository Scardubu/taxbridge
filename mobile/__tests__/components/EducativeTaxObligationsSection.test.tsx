import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import mockEn from '../../i18n/en.json';
import { EducativeTaxObligationsSection } from '../../components/EducativeTaxObligationsSection';

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

describe('EducativeTaxObligationsSection', () => {
  test('expands and collapses inline obligation details', () => {
    const screen = render(
      <EducativeTaxObligationsSection
        isPreviewMode
        obligations={{
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
          complianceScore: 0,
          annualTaxBurden: 0,
        }}
      />
    );

    fireEvent.press(screen.getByLabelText('VAT Registration: Not required yet'));
    expect(screen.getByText(mockEn.obligations.vatRegistration.threshold)).toBeTruthy();
    expect(screen.getByText(`FIRS portal: https://einvoice.firs.gov.ng`)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('VAT Registration: Not required yet'));
    expect(screen.queryByText(mockEn.obligations.vatRegistration.threshold)).toBeNull();
  });
});
