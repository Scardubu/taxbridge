/**
 * onboardingStore.test.ts
 * Blueprint v6 — Zustand onboarding store unit tests
 */

import {
  getNextUnfinishedStepId,
  migrateLegacyStepId,
  STEPS,
  STEP_IDS,
} from '../stores/onboardingStore';

describe('migrateLegacyStepId', () => {
  test('pit → tin-verify', () => {
    expect(migrateLegacyStepId('pit')).toBe('tin-verify');
  });

  test('vatcit → vat-setup', () => {
    expect(migrateLegacyStepId('vatcit')).toBe('vat-setup');
  });

  test('nrs → einvoice', () => {
    expect(migrateLegacyStepId('nrs')).toBe('einvoice');
  });

  test('valid v13 id passes through unchanged', () => {
    expect(migrateLegacyStepId('tin-verify')).toBe('tin-verify');
    expect(migrateLegacyStepId('welcome')).toBe('welcome');
    expect(migrateLegacyStepId('community')).toBe('community');
  });

  test('unknown id falls back to welcome', () => {
    expect(migrateLegacyStepId('totally-unknown')).toBe('welcome');
  });
});

describe('STEPS configuration', () => {
  test('exactly 6 steps defined', () => {
    expect(STEPS).toHaveLength(6);
  });

  test('first step is welcome and is required', () => {
    expect(STEPS[0].id).toBe(STEP_IDS.WELCOME);
    expect(STEPS[0].required).toBe(true);
  });

  test('tin-verify step is required', () => {
    const tin = STEPS.find((s) => s.id === STEP_IDS.TIN_VERIFY);
    expect(tin).toBeDefined();
    expect(tin?.required).toBe(true);
  });

  test('optional steps: vat-setup, einvoice, community', () => {
    const optional = STEPS.filter((s) => !s.required).map((s) => s.id);
    expect(optional).toContain('vat-setup');
    expect(optional).toContain('einvoice');
    expect(optional).toContain('community');
  });

  test('all steps have unique ids', () => {
    const ids = STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all steps have i18n title keys', () => {
    STEPS.forEach((s) => {
      expect(s.titleKey).toMatch(/^onboarding\./);
    });
  });
});

describe('Step ordering invariants', () => {
  test('welcome is step 0', () => {
    expect(STEPS.findIndex((s) => s.id === 'welcome')).toBe(0);
  });

  test('community is last step', () => {
    expect(STEPS.at(-1)?.id).toBe('community');
  });

  test('business-type precedes tin-verify', () => {
    const biIdx = STEPS.findIndex((s) => s.id === 'business-type');
    const tinIdx = STEPS.findIndex((s) => s.id === 'tin-verify');
    expect(biIdx).toBeLessThan(tinIdx);
  });

  test('tin-verify precedes vat-setup', () => {
    const tinIdx = STEPS.findIndex((s) => s.id === 'tin-verify');
    const vatIdx = STEPS.findIndex((s) => s.id === 'vat-setup');
    expect(tinIdx).toBeLessThan(vatIdx);
  });
});

describe('getNextUnfinishedStepId', () => {
  test('returns first step when nothing is completed', () => {
    expect(getNextUnfinishedStepId([])).toBe('welcome');
  });

  test('returns first unfinished optional step after required steps are done', () => {
    expect(getNextUnfinishedStepId(['welcome', 'business-type', 'tin-verify'])).toBe('vat-setup');
  });

  test('returns community when every step is completed', () => {
    expect(getNextUnfinishedStepId(STEPS.map((step) => step.id))).toBe('community');
  });
});
