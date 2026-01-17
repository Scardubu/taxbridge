import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';

dotenv.config();

async function run() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: ts-node src/tools/check-invoice.ts <invoiceId>');
    process.exit(2);
  }
  const inv = await prisma.invoice.findUnique({ where: { id } });
  console.log(inv);
}

run().finally(() => process.exit(0));
