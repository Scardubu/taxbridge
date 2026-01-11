import dotenv from 'dotenv';
import { submitToDigiTax } from '../../integrations/digitax/adapter';

dotenv.config();

async function run() {
  const res = await submitToDigiTax(
    { invoiceId: 'TEST-INVOICE-1', ublXml: '<Invoice><ID>TEST-INVOICE-1</ID></Invoice>' },
    {
      apiUrl: process.env.DIGITAX_API_URL || 'https://sandbox.digitax.com/api',
      apiKey: process.env.DIGITAX_API_KEY || 'api_key_DMkWjuPjyibCGGFGKUxOzOzaVb6HsW7x',
      hmacSecret: process.env.DIGITAX_HMAC_SECRET || 'dummy-secret',
      mockMode: true
    }
  );

  console.log('Digitax submit result:', res);
}

run().catch((err) => {
  console.error('Digitax test failed:', err);
  process.exit(1);
});
