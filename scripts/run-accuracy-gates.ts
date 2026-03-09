import { calculatePIT, calculatePenalty, calculateCIT } from '../packages/contracts/src/index';
import { formatNGN } from '../mobile/src/design-system/ngn';

function assertEqual(actual: number | string, expected: number | string, label: string): void {
  if (actual !== expected) {
    process.stderr.write(`FAIL ${label}: expected ${expected}, received ${actual}\n`);
    process.exit(1);
  }

  process.stdout.write(`✅ ${label}: ${actual}\n`);
}

function assertNear(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    process.stderr.write(`FAIL ${label}: expected ${expected}, received ${actual}\n`);
    process.exit(1);
  }

  process.stdout.write(`✅ ${label}: ${actual}\n`);
}

function main(): void {
  const pit = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
  assertNear(pit.taxLiability, 632_400, 1, 'PIT');

  const penalty = calculatePenalty({
    entityType: 'company',
    daysLate: 32,
    taxAmountDue: 0,
    disclosurePhase: 'after_assessment',
  });
  assertEqual(penalty.netPenalty, 375_000, 'Penalty');

  const citLarge = calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 });
  assertEqual(citLarge.citLiability, 4_500_000, 'CIT large');

  const citSmall = calculateCIT({ turnover: 80_000_000, taxableProfit: 5_000_000 });
  assertEqual(citSmall.citLiability, 0, 'CIT small');

  assertEqual(formatNGN(632_400), '₦632,400', 'formatNGN standard');
  assertEqual(formatNGN(5_000_000, { compact: true }), '₦5.0M', 'formatNGN compact');
}

main();
