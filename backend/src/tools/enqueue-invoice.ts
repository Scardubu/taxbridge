import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';
import { getInvoiceSyncQueue } from '../queue/client';
import { calculateInvoiceTotals } from '../utils/taxCalculator';

dotenv.config();


async function run() {
  // create a test user
  const phone = `+234${Math.floor(1000000000 + Math.random() * 8999999999)}`;
  const user = await prisma.user.create({
    data: {
      phone,
      name: 'Test Merchant',
      tin: 'TEST-TIN-12345'
    }
  });

  const items = [
    { description: 'Rice', quantity: 2, unitPrice: 2000 },
    { description: 'Beans', quantity: 1, unitPrice: 1500 }
  ];

  const totals = calculateInvoiceTotals(items);

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      customerName: 'Test Customer',
      items: items as any,
      subtotal: totals.subtotal as any,
      vat: totals.vat as any,
      total: totals.total as any,
      status: 'queued'
    }
  });

  console.log('Created invoice', invoice.id);

  const queue = getInvoiceSyncQueue();
  if (!queue) {
    console.warn('Queue unavailable - invoice will be processed synchronously');
    return;
  }
  
  await queue.add('sync', { invoiceId: invoice.id });

  console.log('Enqueued invoice job for', invoice.id);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('enqueue failed', err);
    process.exit(1);
  });
