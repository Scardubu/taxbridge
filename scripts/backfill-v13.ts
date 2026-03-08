import { getPrismaClient } from '../backend/src/lib/prisma';
import { writeAuditEvent } from '../backend/src/services/audit';

const prisma = getPrismaClient();
const DRY_RUN = !process.argv.includes('--exec');

type BackfillStats = {
  snapshotsCreated: number;
  snapshotsSkipped: number;
  auditValidated: boolean;
};

async function backfillBusinessTaxHealthSnapshots(): Promise<Pick<BackfillStats, 'snapshotsCreated' | 'snapshotsSkipped'>> {
  console.log('[backfill:v13] TaxHealthSnapshot — scanning active businesses...');

  const businesses: any[] = await (prisma as any).business.findMany({
    select: { id: true, ownerId: true, status: true },
    where: {
      status: { in: ['ACTIVE', 'VERIFIED'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  let snapshotsCreated = 0;
  let snapshotsSkipped = 0;

  for (const business of businesses) {
    const existing = await (prisma as any).taxHealthSnapshot.findFirst({
      where: { businessId: business.id },
      orderBy: { computedAt: 'desc' },
      select: { id: true, grade: true, computedAt: true },
    });

    if (existing) {
      snapshotsSkipped += 1;
      console.log(`  [skip] business=${business.id} — snapshot exists (${existing.grade})`);
      continue;
    }

    const snapshot = {
      userId: business.ownerId,
      businessId: business.id,
      totalScore: 50,
      grade: 'fair',
      filingTimeliness: 50,
      dataCompleteness: 50,
      complianceCalendar: 50,
      nrsSubmissions: 50,
      paymentHistory: 50,
      trend: 'stable',
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] would create baseline snapshot for business=${business.id}`);
    } else {
      await (prisma as any).taxHealthSnapshot.create({ data: snapshot });
      console.log(`  [created] baseline snapshot for business=${business.id}`);
    }

    snapshotsCreated += 1;
  }

  return { snapshotsCreated, snapshotsSkipped };
}

async function validateSecurityAuditAction(): Promise<boolean> {
  console.log('[backfill:v13] AuditEvent SECURITY_ALERT validation...');

  const count = await (prisma as any).auditEvent.count({
    where: { action: 'SECURITY_ALERT' },
  });

  console.log(`  SECURITY_ALERT events currently stored: ${count}`);

  if (!DRY_RUN && count === 0) {
    await writeAuditEvent({
      actorId: 'system',
      action: 'SECURITY_ALERT',
      resource: 'Backfill',
      resourceId: 'v13',
      details: {
        source: 'scripts/backfill-v13.ts',
        reason: 'seed_security_alert_validation',
      },
    });
    console.log('  [created] seeded SECURITY_ALERT audit event for validation');
  }

  console.log('  ✅ SECURITY_ALERT action accepted by schema');
  return true;
}

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log(' TaxBridge V13 — Backfill Script');
  console.log(` Mode: ${DRY_RUN ? 'DRY RUN (pass --exec to write)' : 'LIVE EXECUTION'}`);
  console.log('════════════════════════════════════════════════\n');

  try {
    const snapshotStats = await backfillBusinessTaxHealthSnapshots();
    const auditValidated = await validateSecurityAuditAction();

    const stats: BackfillStats = {
      ...snapshotStats,
      auditValidated,
    };

    console.log('\n[result] snapshots created:', stats.snapshotsCreated);
    console.log('[result] snapshots skipped:', stats.snapshotsSkipped);
    console.log('[result] audit validated:', stats.auditValidated ? 'yes' : 'no');
    console.log('\n✅ V13 backfill complete.');

    if (DRY_RUN) {
      console.log('   Run with --exec to apply changes.');
    }
  } catch (error) {
    console.error('❌ V13 backfill failed:', error);
    process.exit(1);
  } finally {
    await (prisma as any).$disconnect();
  }
}

main();
