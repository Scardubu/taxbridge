#!/usr/bin/env tsx
/**
 * TaxBridge — Development Seed Script
 *
 * Creates baseline entities for local development:
 *   - Organisation (Acme Ltd)
 *   - User (admin@acme.ng, SUPER_ADMIN)
 *   - 3 TaxReturn records
 *   - TaxHealthSnapshot (score: 62)
 *
 * Usage:
 *   yarn workspace backend ts-node scripts/seed-dev.ts
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding development data…');

  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  const user = await (prisma as any).user.upsert({
    where: { email: 'admin@acme.ng' },
    update: {},
    create: {
      id: userId,
      email: 'admin@acme.ng',
      name: 'Dev Admin',
      phone: '+2348012345678',
      passwordHash: '$2b$10$placeholder',
      verified: true,
      role: 'SUPER_ADMIN',
    },
  });

  const org = await (prisma as any).org.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: 'Acme Ltd',
      vatRegistrationNumber: '12345678-0001',
      status: 'active',
    },
  });

  await (prisma as any).orgMember.upsert({
    where: { id: crypto.randomUUID() },
    update: {},
    create: {
      orgId: org.id,
      userId: user.id,
      role: 'OWNER',
      status: 'active',
    },
  });

  const taxTypes = ['VAT', 'WHT', 'PAYE'];
  for (const taxType of taxTypes) {
    await (prisma as any).taxReturn?.create({
      data: {
        orgId: org.id,
        userId: user.id,
        taxType,
        period: '2026-01',
        filingReference: `TB-2026-${taxType}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        status: 'FILED',
        submittedAt: new Date(),
      },
    }).catch(() => {
      console.log(`  Skipped ${taxType} TaxReturn (model may not exist yet)`);
    });
  }

  await (prisma as any).taxHealthSnapshot.create({
    data: {
      userId: user.id,
      businessId: org.id,
      totalScore: 62,
      grade: 'fair',
      filingTimeliness: 70,
      dataCompleteness: 55,
      complianceCalendar: 60,
      nrsSubmissions: 65,
      paymentHistory: 60,
      trend: 'improving',
    },
  }).catch(() => {
    console.log('  Skipped TaxHealthSnapshot (model may not exist yet)');
  });

  console.log('Seed complete.');
  console.log(`  User: ${user.email} (${user.id})`);
  console.log(`  Org:  ${org.name} (${org.id})`);
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
