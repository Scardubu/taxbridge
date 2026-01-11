import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { getInvoiceSyncQueue } from '../queue/client';

dotenv.config();

const prisma = new PrismaClient();

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

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const vat = Math.round(subtotal * 0.075 * 100) / 100; // 7.5% example
  const total = subtotal + vat;

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      customerName: 'Test Customer',
      items: items as any,
      subtotal: subtotal as any,
      vat: vat as any,
      total: total as any,
      status: 'queued'
    }
  });

  console.log('Created invoice', invoice.id);

  const queue = getInvoiceSyncQueue();
  await queue.add('sync', { invoiceId: invoice.id });

  console.log('Enqueued invoice job for', invoice.id);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('enqueue failed', err);
    process.exit(1);
  });
