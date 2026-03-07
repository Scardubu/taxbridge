import dotenv from 'dotenv';
import { submitToDigiTax } from '../integrations/digitax/adapter';
import { generateUBL } from '../lib/ubl/generator';
import { createLogger } from '../lib/logger';

dotenv.config();

const log = createLogger('digitax-test');

async function run() {
  const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'true').toLowerCase() !== 'false';
  const ublXml = generateUBL({
    id: 'TEST-INVOICE-1',
    issueDate: new Date().toISOString().split('T')[0],
    supplierTIN: '12345678-0001',
    supplierName: 'Test Supplier Ltd',
    customerTIN: '98765432-0002',
    customerName: 'Test Customer Ltd',
    items: [{ description: 'Test Item', quantity: 1, unitPrice: 100 }],
    subtotal: 100,
    vat: 7.5,
    total: 107.5
  });
  const res = await submitToDigiTax(
    { invoiceId: 'TEST-INVOICE-1', ublXml },
    {
      apiUrl: process.env.DIGITAX_API_URL || 'https://sandbox.digitax.com/api',
      apiKey: process.env.DIGITAX_API_KEY || '',
      hmacSecret: process.env.DIGITAX_HMAC_SECRET || undefined,
      mockMode
    }
  );

  log.info('Digitax submit result', { result: res });
}

run().catch((err) => {
  log.error('Digitax test failed', { err });
  process.exit(1);
});
