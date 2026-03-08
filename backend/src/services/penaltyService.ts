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
  /** Maps to contracts DisclosurePhase. Default 'before_audit' (voluntary). */
  disclosurePhase?: 'voluntary' | 'investigation' | 'prosecution';
}

export interface PenaltyOutput {
  lateFiling:        number;
  interest:          number;
  netPenalty:        number;
  disclosurePhase:   string;
}

/** Map service-layer disclosure names to contracts DisclosurePhase values */
function mapDisclosurePhase(phase?: string): 'before_audit' | 'during_audit' | 'after_assessment' {
  if (phase === 'investigation') return 'during_audit';
  if (phase === 'prosecution')   return 'after_assessment';
  return 'before_audit'; // 'voluntary' or undefined
}

/**
 * computePenalty — production wrapper.
 * Reads CBN_MPR from environment, passes through to contracts math.
 * Never throws — returns zero penalty on error.
 */
export function computePenalty(input: PenaltyInput): PenaltyOutput {
  try {
    const result = calculatePenalty({
      entityType:      input.entityType,
      daysLate:        input.daysLate,
      taxAmountDue:    input.taxAmountDue,
      disclosurePhase: mapDisclosurePhase(input.disclosurePhase),
    });

    return {
      lateFiling:      result.lateFiling,
      interest:        result.interest,
      netPenalty:      result.netPenalty,
      disclosurePhase: input.disclosurePhase ?? 'voluntary',
    };
  } catch (err) {
    logger.error({ err }, 'penaltyService.computePenalty failed — returning zero');
    return { lateFiling: 0, interest: 0, netPenalty: 0, disclosurePhase: 'voluntary' };
  }
}
