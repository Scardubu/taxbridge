#!/usr/bin/env bash
set -euo pipefail

npx tsx -e "
  import { calculatePIT } from './packages/contracts/src/index.ts';
  const r = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
  if (Math.abs(r.taxLiability - 632_400) > 1) { process.stderr.write('FAIL ' + r.taxLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ PIT: ' + r.taxLiability + '\n');
"

npx tsx -e "
  import { calculatePenalty } from './packages/contracts/src/index.ts';
  const r = calculatePenalty({ entityType: 'company', daysLate: 32, taxAmountDue: 0, disclosurePhase: 'before_audit' });
  if (r.netPenalty !== 375_000) { process.stderr.write('FAIL ' + r.netPenalty + '\n'); process.exit(1); }
  process.stdout.write('✅ Penalty: ' + r.netPenalty + '\n');
"

npx tsx -e "
  import { calculateCIT } from './packages/contracts/src/index.ts';
  const r = calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 });
  if (r.citLiability !== 4_500_000) { process.stderr.write('FAIL ' + r.citLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ CIT large: ' + r.citLiability + '\n');
"

npx tsx -e "
  import { calculateCIT } from './packages/contracts/src/index.ts';
  const r = calculateCIT({ turnover: 80_000_000, taxableProfit: 5_000_000 });
  if (r.citLiability !== 0) { process.stderr.write('FAIL ' + r.citLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ CIT small: ' + r.citLiability + '\n');
"

npx tsx -e "
  import { formatNGN } from './mobile/src/design-system/ngn.ts';
  if (formatNGN(632_400) !== '₦632,400') process.exit(1);
  if (formatNGN(5_000_000, { compact: true }) !== '₦5.0M') process.exit(1);
  process.stdout.write('✅ formatNGN gates passed\n');
"
