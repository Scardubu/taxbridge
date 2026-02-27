import { UserProfile, Achievement } from '../contexts/OnboardingContext';

export interface Nudge {
  id: string;
  message: string;
  trigger: string;
  cta?: {
    text: string;
    action: string;
  };
  riskLevel: 'safe' | 'review_required';
}

export const NUDGE_TEMPLATES: Nudge[] = [
  {
    id: 'pit_free',
    trigger: 'low_income',
    message: 'Your charged income may be fully tax-free after reliefs 🎉',
    cta: { text: 'Review Reliefs', action: 'review_reliefs' },
    riskLevel: 'safe',
  },
  {
    id: 'vat_warning',
    trigger: 'vat_threshold_approaching',
    message: 'Approaching the ₦100M VAT threshold—learn registration basics now.',
    cta: { text: 'Learn Basics', action: 'learn_vat' },
    riskLevel: 'safe',
  },
  {
    id: 'nrs_demo',
    trigger: 'nrs_compliance',
    message: 'See how e-Invoicing protects you from ₦10M penalties—try the mock demo.',
    cta: { text: 'Try Demo', action: 'try_nrs_demo' },
    riskLevel: 'safe',
  },
  {
    id: 'rent_relief',
    trigger: 'rent_payer',
    message: 'Did you know? Rent Relief can lower your taxable income by up to ₦500k.',
    cta: { text: 'Check Calculator', action: 'open_calculator' },
    riskLevel: 'safe',
  },
];

export function getNudgesForProfile(
  profile: UserProfile,
  achievements: Achievement[]
): Nudge[] {
  const activeNudges: Nudge[] = [];

  // 1. Low Income Nudge
  if (profile.annualIncome && profile.annualIncome <= 800_000) {
    const nudge = NUDGE_TEMPLATES.find(n => n.id === 'pit_free');
    if (nudge) activeNudges.push(nudge);
  }

  // 2. VAT Threshold Nudge
  if (profile.annualTurnover && profile.annualTurnover >= 80_000_000) {
    const nudge = NUDGE_TEMPLATES.find(n => n.id === 'vat_warning');
    if (nudge) activeNudges.push(nudge);
  }

  // 3. NRS Demo Nudge (if not completed)
  const nrsAchievement = achievements.find(a => a.id === 'nrs_explorer');
  if (!nrsAchievement?.unlockedAt) {
    const nudge = NUDGE_TEMPLATES.find(n => n.id === 'nrs_demo');
    if (nudge) activeNudges.push(nudge);
  }

  // 4. Rent Relief Nudge (General awareness if income is decent but not huge)
  if (profile.annualIncome && profile.annualIncome > 800_000 && profile.incomeSource !== 'investments') {
     const nudge = NUDGE_TEMPLATES.find(n => n.id === 'rent_relief');
     if (nudge) activeNudges.push(nudge);
  }

  return activeNudges;
}
