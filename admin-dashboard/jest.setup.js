require('@testing-library/jest-dom')

jest.mock('@/lib/i18n', () => {
  const translate = (key, vars = {}) => {
    const messages = {
      'healthcard.latency.na': 'N/A',
      'healthcard.status.healthy': 'Latency',
      'healthcard.status.degraded': 'Latency',
      'healthcard.status.error': 'Latency',
      'healthcard.status.unknown': 'Latency',
      'healthcard.badge.healthy': 'HEALTHY',
      'healthcard.badge.degraded': 'DEGRADED',
      'healthcard.badge.error': 'ERROR',
      'healthcard.latency.lastChecked': `Latency • Last checked ${vars.time ?? ''}`.trim(),
      'ubl.compliance.title': 'UBL 3.0 Compliance Check',
      'ubl.compliance.complete': `Complete (${vars.percent ?? '0'}%)`,
      'ubl.compliance.summary': `${vars.present ?? 0}/${vars.total ?? 0} mandatory fields present`,
      'ubl.tabs.validation': 'Validation',
      'ubl.tabs.xml': 'Raw XML',
      'ubl.tabs.parsed': 'Parsed',
      'ubl.validation.title': 'Mandatory fields',
      'ubl.validation.valueLabel': 'Value:',
      'ubl.validation.present': 'Present',
      'ubl.validation.missing': 'Missing',
      'ubl.field.invoiceId': 'Invoice number',
      'ubl.field.issueDate': 'Invoice date (YYYY-MM-DD)',
      'ubl.field.invoiceTypeCode': 'Invoice type code',
      'ubl.field.profileId': 'Profile ID',
      'ubl.field.currencyCode': 'Document currency',
      'ubl.field.supplierTin': 'Supplier TIN',
      'ubl.field.supplierName': 'Supplier name',
      'ubl.field.customerTin': 'Customer TIN',
      'ubl.field.customerName': 'Customer name',
      'ubl.field.lineId': 'Invoice line ID',
      'ubl.field.quantity': 'Invoiced quantity',
      'ubl.field.lineAmount': 'Line extension amount',
      'ubl.field.itemDescription': 'Item description',
      'ubl.field.unitPrice': 'Unit price',
      'ubl.field.totalTaxAmount': 'Total tax amount',
      'ubl.field.subtotal': 'Subtotal',
      'ubl.field.taxExclusiveAmount': 'Tax exclusive amount',
      'ubl.field.taxInclusiveAmount': 'Tax inclusive amount',
      'ubl.field.amountPayable': 'Amount payable',
    }

    return messages[key] ?? key
  }

  return {
    AdminI18nProvider: ({ children }) => children,
    useAdminI18n: () => ({
      lang: 'en',
      setLang: jest.fn(),
      t: translate,
    }),
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
  useSWR: jest.fn(),
}))
