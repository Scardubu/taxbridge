import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';

dotenv.config();

const log = createLogger('check-invoice');

async function run() {
  const id = process.argv[2];
  if (!id) {
    log.error('Usage: ts-node src/tools/check-invoice.ts <invoiceId>');
    process.exit(2);
  }
  const inv = await prisma.invoice.findUnique({ where: { id } });
  log.info('Invoice', { invoice: inv });
}

run().finally(() => process.exit(0));
