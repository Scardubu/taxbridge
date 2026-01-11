import dotenv from 'dotenv';
import { generateUBL } from '../lib/ubl/generator';
import { submitToDigiTax } from '../integrations/digitax/adapter';

dotenv.config();

async function run() {
  const invoice = {
    id: 'SIM-INV-001',
    issueDate: new Date().toISOString().slice(0, 10),
    supplierTIN: 'TEST-TIN-12345',
    supplierName: 'TaxBridge Merchant',
    customerName: 'Sim Customer',
    items: [
      { description: 'Rice', quantity: 2, unitPrice: 2000 },
      { description: 'Beans', quantity: 1, unitPrice: 1500 }
    ],
    subtotal: 5500,
    vat: 412.5,
    total: 5912.5
  };

  const ublXml = generateUBL(invoice as any);

  console.log('Generated UBL (truncated):', ublXml.slice(0, 200));

  const res = await submitToDigiTax(
    { invoiceId: invoice.id, ublXml },
    {
      apiUrl: process.env.DIGITAX_API_URL || 'https://sandbox.digitax.com/api',
      apiKey: process.env.DIGITAX_API_KEY || '',
      hmacSecret: process.env.DIGITAX_HMAC_SECRET || undefined,
      mockMode: String(process.env.DIGITAX_MOCK_MODE || 'true').toLowerCase() !== 'false'
    }
  );

  console.log('Submit result:', res);
}

run().catch((err) => {
  console.error('mock-worker-sim failed:', err);
  process.exit(1);
});
