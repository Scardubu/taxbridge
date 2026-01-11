import { generateUBL } from './generator';

const testInvoice = {
  id: 'INV-001',
  issueDate: '2026-01-15',
  supplierTIN: '12345678-0001',
  supplierName: 'TaxBridge Test Merchant',
  customerName: 'Aunty Ngozi',
  items: [
    { description: 'Fresh Tomatoes 1kg', quantity: 10, unitPrice: 500 },
    { description: 'Onions 1kg', quantity: 5, unitPrice: 300 }
  ],
  subtotal: 6500,
  vat: 487.5,
  total: 6987.5
};

test('generateUBL produces xml containing invoice id', () => {
  const xml = generateUBL(testInvoice);
  expect(xml).toContain(testInvoice.id);
});
