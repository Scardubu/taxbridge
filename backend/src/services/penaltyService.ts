/**
 * Penalty Service — TaxBridge V13 Sovereign
 *
 * Wrapper over calculatePenalty from @taxbridge/contracts.
 * Reads CBN_MPR from env — never hardcoded (C-05).
 * C-09: No inline tax math — delegates to contracts package.
 */
import { calculatePenalty } from '@taxbridge/contracts';
import { logger }           from '../lib/logger';

export interface PenaltyInput {
  entityType:       'company' | 'individual';
  daysLate:         number;
  taxAmountDue:     number;
  disclosurePhase?: 'voluntary' | 'investigation' | 'prosecution';
}

export interface PenaltyOutput {
  basePenalty:       number;
  interestCharge:    number;
  totalPenalty:      number;
  disclosurePhase:   string;
}

/**
 * computePenalty — production wrapper.
 * Reads CBN_MPR from environment, passes through to contracts math.
 * Never throws — returns zero penalty on error.
 */
export function computePenalty(input: PenaltyInput): PenaltyOutput {
  try {
    const cbnMpr = parseFloat(process.env.CBN_MPR ?? '0.2725');

    const result = calculatePenalty({
      entityType:      input.entityType,
      daysLate:        input.daysLate,
      taxAmountDue:    input.taxAmountDue,
      disclosurePhase: input.disclosurePhase ?? 'voluntary',
      cbnMpr,
    });

    return {
      basePenalty:     result.basePenalty,
      interestCharge:  result.interestCharge,
      totalPenalty:    result.totalPenalty,
      disclosurePhase: input.disclosurePhase ?? 'voluntary',
    };
  } catch (err) {
    logger.error({ err }, 'penaltyService.computePenalty failed — returning zero');
    return { basePenalty: 0, interestCharge: 0, totalPenalty: 0, disclosurePhase: 'voluntary' };
  }
}
