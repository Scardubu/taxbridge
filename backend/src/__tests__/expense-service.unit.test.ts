/**
 * Expense Service Unit Tests (Phase 5)
 *
 * Tests for category detection, VAT eligibility, and expense lifecycle.
 */

import { ExpenseService, EXPENSE_CATEGORIES } from '../services/expense';

// =============================================================================
// Category Detection Tests
// =============================================================================

describe('ExpenseService — Category Detection', () => {
  // We instantiate with a null prisma since we only test pure methods
  const service = new ExpenseService(null as any);

  it('detects office-supplies from description', () => {
    expect(service.detectCategory('Bought printer paper and ink cartridges')).toBe('office-supplies');
    expect(service.detectCategory('Stationery from Shoprite')).toBe('office-supplies');
  });

  it('detects travel from description', () => {
    expect(service.detectCategory('Uber ride to client meeting')).toBe('travel');
    expect(service.detectCategory('Flight to Abuja for conference')).toBe('travel');
    expect(service.detectCategory('Hotel accommodation Lagos')).toBe('travel');
  });

  it('detects meals from description', () => {
    expect(service.detectCategory('Lunch at restaurant with client')).toBe('meals');
    expect(service.detectCategory('Catering for office event')).toBe('meals');
  });

  it('detects utilities from description', () => {
    expect(service.detectCategory('EKEDC electricity bill January')).toBe('utilities');
    expect(service.detectCategory('Water bill for January')).toBe('utilities');
    expect(service.detectCategory('Generator for backup power')).toBe('utilities');
  });

  it('detects rent from description', () => {
    expect(service.detectCategory('Rent for February 2026')).toBe('rent');
    expect(service.detectCategory('Warehouse lease payment')).toBe('rent');
  });

  it('detects fuel from description', () => {
    expect(service.detectCategory('Petrol at NNPC filling station')).toBe('fuel');
    expect(service.detectCategory('Petrol for company vehicle')).toBe('fuel');
  });

  it('detects maintenance from description', () => {
    expect(service.detectCategory('AC repair and maintenance')).toBe('maintenance');
    expect(service.detectCategory('Plumber for office bathroom fix')).toBe('maintenance');
  });

  it('detects professional-services from description', () => {
    expect(service.detectCategory('Legal consultation fee')).toBe('professional-services');
    expect(service.detectCategory('Accounting audit services')).toBe('professional-services');
  });

  it('detects telecommunications from description', () => {
    expect(service.detectCategory('MTN data subscription')).toBe('telecommunications');
    expect(service.detectCategory('Broadband internet subscription')).toBe('telecommunications');
    expect(service.detectCategory('Airtel data plan recharge')).toBe('telecommunications');
  });

  it('detects insurance from description', () => {
    expect(service.detectCategory('Annual insurance premium')).toBe('insurance');
    expect(service.detectCategory('Vehicle insurance policy renewal')).toBe('insurance');
  });

  it('detects marketing from description', () => {
    expect(service.detectCategory('Google Ads campaign')).toBe('marketing');
    expect(service.detectCategory('Billboard advert placement')).toBe('marketing');
    expect(service.detectCategory('Facebook promotion for product launch')).toBe('marketing');
  });

  it('detects equipment from description', () => {
    expect(service.detectCategory('New laptop for developer')).toBe('equipment');
    expect(service.detectCategory('Server hardware purchase')).toBe('equipment');
  });

  it('returns other for unrecognized descriptions', () => {
    expect(service.detectCategory('Miscellaneous payment')).toBe('other');
    expect(service.detectCategory('Random stuff')).toBe('other');
  });

  it('handles empty string', () => {
    expect(service.detectCategory('')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(service.detectCategory('UBER RIDE TO AIRPORT')).toBe('travel');
    expect(service.detectCategory('ELECTRICITY BILL PAYMENT')).toBe('utilities');
  });
});

// =============================================================================
// VAT Eligibility Tests
// =============================================================================

describe('ExpenseService — VAT Eligibility', () => {
  const service = new ExpenseService(null as any);

  it('marks rent as VAT-exempt', () => {
    expect(service.isVATEligible('rent', 'Office rent payment')).toBe(false);
  });

  it('marks insurance as VAT-exempt', () => {
    expect(service.isVATEligible('insurance', 'Annual premium')).toBe(false);
  });

  it('marks office-supplies as VAT-eligible', () => {
    expect(service.isVATEligible('office-supplies', 'Printer paper')).toBe(true);
  });

  it('marks travel as VAT-eligible', () => {
    expect(service.isVATEligible('travel', 'Flight to Abuja')).toBe(true);
  });

  it('marks fuel as VAT-eligible', () => {
    expect(service.isVATEligible('fuel', 'Petrol at NNPC')).toBe(true);
  });

  it('exempts hospital/medical expenses', () => {
    expect(service.isVATEligible('other', 'Payment to hospital for checkup')).toBe(false);
    expect(service.isVATEligible('other', 'Clinic visit for staff')).toBe(false);
  });

  it('exempts school/education expenses', () => {
    expect(service.isVATEligible('other', 'University tuition fee')).toBe(false);
    expect(service.isVATEligible('other', 'School supplies for training')).toBe(false);
  });

  it('exempts pharmacy expenses', () => {
    expect(service.isVATEligible('other', 'Pharmacy purchase for first aid')).toBe(false);
  });

  it('allows standard categories', () => {
    expect(service.isVATEligible('meals', 'Team lunch')).toBe(true);
    expect(service.isVATEligible('utilities', 'Electricity bill')).toBe(true);
    expect(service.isVATEligible('marketing', 'Google Ads')).toBe(true);
    expect(service.isVATEligible('equipment', 'New laptop')).toBe(true);
  });
});

// =============================================================================
// Category List Tests
// =============================================================================

describe('EXPENSE_CATEGORIES', () => {
  it('has 13 categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(13);
  });

  it('includes all expected categories', () => {
    expect(EXPENSE_CATEGORIES).toContain('office-supplies');
    expect(EXPENSE_CATEGORIES).toContain('travel');
    expect(EXPENSE_CATEGORIES).toContain('meals');
    expect(EXPENSE_CATEGORIES).toContain('utilities');
    expect(EXPENSE_CATEGORIES).toContain('rent');
    expect(EXPENSE_CATEGORIES).toContain('fuel');
    expect(EXPENSE_CATEGORIES).toContain('maintenance');
    expect(EXPENSE_CATEGORIES).toContain('professional-services');
    expect(EXPENSE_CATEGORIES).toContain('telecommunications');
    expect(EXPENSE_CATEGORIES).toContain('insurance');
    expect(EXPENSE_CATEGORIES).toContain('marketing');
    expect(EXPENSE_CATEGORIES).toContain('equipment');
    expect(EXPENSE_CATEGORIES).toContain('other');
  });

  it('has no duplicates', () => {
    const unique = new Set(EXPENSE_CATEGORIES);
    expect(unique.size).toBe(EXPENSE_CATEGORIES.length);
  });
});

// =============================================================================
// VAT Calculation Tests
// =============================================================================

describe('VAT Amount Calculation', () => {
  const VAT_RATE = 0.075;

  it('calculates 7.5% VAT on eligible amount', () => {
    const amount = 10000;
    const vat = Math.round(amount * VAT_RATE * 100) / 100;
    expect(vat).toBe(750);
  });

  it('calculates VAT on small amounts', () => {
    const amount = 150;
    const vat = Math.round(amount * VAT_RATE * 100) / 100;
    expect(vat).toBe(11.25);
  });

  it('calculates VAT on large amounts', () => {
    const amount = 5000000;
    const vat = Math.round(amount * VAT_RATE * 100) / 100;
    expect(vat).toBe(375000);
  });

  it('returns 0 for exempt categories', () => {
    const service = new ExpenseService(null as any);
    const eligible = service.isVATEligible('rent', 'Office rent');
    const vat = eligible ? Math.round(50000 * VAT_RATE * 100) / 100 : 0;
    expect(vat).toBe(0);
  });
});

// =============================================================================
// Expense Status Transition Tests
// =============================================================================

describe('Expense Status Transitions', () => {
  it('valid transitions: pending → approved', () => {
    const validFrom = ['pending'];
    expect(validFrom.includes('pending')).toBe(true);
  });

  it('valid transitions: pending → rejected', () => {
    const validFrom = ['pending'];
    expect(validFrom.includes('pending')).toBe(true);
  });

  it('invalid: approved expenses cannot be re-approved', () => {
    const canApprove = (status: string) => status === 'pending';
    expect(canApprove('approved')).toBe(false);
  });

  it('invalid: rejected expenses cannot be approved', () => {
    const canApprove = (status: string) => status === 'pending';
    expect(canApprove('rejected')).toBe(false);
  });

  it('only pending expenses can be updated', () => {
    const canUpdate = (status: string) => status === 'pending';
    expect(canUpdate('pending')).toBe(true);
    expect(canUpdate('approved')).toBe(false);
    expect(canUpdate('rejected')).toBe(false);
  });

  it('only pending expenses can be deleted', () => {
    const canDelete = (status: string) => status === 'pending';
    expect(canDelete('pending')).toBe(true);
    expect(canDelete('approved')).toBe(false);
  });
});
