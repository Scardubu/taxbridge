import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AppKV, zustandKvStorage } from '../storage/kv';
import { apiRequest } from '../services/api';
import { logComplianceEvent } from '../services/complianceEventService';
import { getDatabase } from '../services/database';

export const STEP_IDS = {
  WELCOME: 'welcome',
  BUSINESS_TYPE: 'business-type',
  TIN_VERIFY: 'tin-verify',
  VAT_SETUP: 'vat-setup',
  EINVOICE: 'einvoice',
  COMMUNITY: 'community',
} as const;

export type StepId = typeof STEP_IDS[keyof typeof STEP_IDS];

export const DEFAULT_TAB_ROUTE = '/(tabs)' as const;

export const STEP_ROUTES: Record<StepId, `/(onboarding)/${string}`> = {
  welcome: '/(onboarding)/welcome',
  'business-type': '/(onboarding)/business-type',
  'tin-verify': '/(onboarding)/tin-verify',
  'vat-setup': '/(onboarding)/vat-setup',
  einvoice: '/(onboarding)/einvoice',
  community: '/(onboarding)/community',
};

export interface OnboardingStep {
  id: StepId;
  titleKey: string;
  required: boolean;
  backendSyncOnComplete: boolean;
}

export const STEPS: OnboardingStep[] = [
  { id: 'welcome', titleKey: 'onboarding.welcome.title', required: true, backendSyncOnComplete: false },
  { id: 'business-type', titleKey: 'onboarding.businessType.title', required: true, backendSyncOnComplete: true },
  { id: 'tin-verify', titleKey: 'onboarding.tinVerify.title', required: true, backendSyncOnComplete: true },
  { id: 'vat-setup', titleKey: 'onboarding.vatSetup.title', required: false, backendSyncOnComplete: true },
  { id: 'einvoice', titleKey: 'onboarding.einvoice.title', required: false, backendSyncOnComplete: false },
  { id: 'community', titleKey: 'onboarding.community.title', required: false, backendSyncOnComplete: false },
];

const LEGACY: Record<string, StepId> = {
  pit: 'tin-verify',
  vatcit: 'vat-setup',
  nrs: 'einvoice',
};

export function migrateLegacyStepId(raw: string): StepId {
  return LEGACY[raw] ?? (STEPS.find((step) => step.id === raw)?.id ?? 'welcome');
}

function deriveCompletedSteps(currentStepId: StepId): StepId[] {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);
  if (currentIndex <= 0) {
    return [];
  }

  return STEPS.slice(0, currentIndex).map((step) => step.id);
}

function getUniqueSteps(steps: StepId[]): StepId[] {
  return Array.from(new Set(steps));
}

export function getNextUnfinishedStepId(completedSteps: StepId[]): StepId {
  return STEPS.find((step) => !completedSteps.includes(step.id))?.id ?? STEP_IDS.COMMUNITY;
}

function mirrorOnboardingState(currentStepId: StepId, isComplete: boolean) {
  AppKV.onboarding.setStep(currentStepId);
  AppKV.onboarding.setComplete(isComplete);
}

interface OnboardingStore {
  currentStepId: StepId;
  completedSteps: StepId[];
  isComplete: boolean;
  schemaVersion: number;
  isSyncing: boolean;
  hasHydrated: boolean;
  goNext(): Promise<void>;
  goPrev(): void;
  skipAllOptional(): Promise<void>;
  skipForNow(): Promise<void>;
  complete(): Promise<void>;
  migrateIfNeeded(): void;
  markHydrated(): void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      currentStepId: 'welcome',
      completedSteps: [],
      isComplete: false,
      schemaVersion: 13,
      isSyncing: false,
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      migrateIfNeeded: () => {
        const { currentStepId, completedSteps, schemaVersion } = get();
        const migratedStepId = migrateLegacyStepId(currentStepId);
        const migratedCompletedSteps = getUniqueSteps([
          ...deriveCompletedSteps(migratedStepId),
          ...completedSteps.map(migrateLegacyStepId),
        ]);

        if (schemaVersion < 13 || migratedStepId !== currentStepId) {
          set({
            currentStepId: migratedStepId,
            completedSteps: migratedCompletedSteps,
            schemaVersion: 13,
          });
        }

        mirrorOnboardingState(migratedStepId, get().isComplete);
      },
      goNext: async () => {
        const { currentStepId, completedSteps } = get();
        const idx = STEPS.findIndex((step) => step.id === currentStepId);
        const newCompleted = completedSteps.includes(currentStepId)
          ? completedSteps
          : [...completedSteps, currentStepId];

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (idx >= 0 && STEPS[idx].backendSyncOnComplete) {
          set({ isSyncing: true });
          apiRequest('/api/v1/onboarding/step-complete', {
            method: 'POST',
            body: JSON.stringify({ stepId: currentStepId }),
          })
            .catch(async () => {
              const db = await getDatabase();
              await db.runAsync(
                `INSERT OR IGNORE INTO offline_operations (client_id, type, payload)
                 VALUES (?, 'PROFILE_SYNC', ?)`,
                [`step_${currentStepId}_${Date.now()}`, JSON.stringify({ stepId: currentStepId })]
              );
            })
            .finally(() => set({ isSyncing: false }));
        }

        if (idx >= STEPS.length - 1) {
          await get().complete();
          return;
        }

        const nextStepId = STEPS[idx + 1].id;
        set({ currentStepId: nextStepId, completedSteps: newCompleted });
        mirrorOnboardingState(nextStepId, false);
      },
      goPrev: () => {
        const idx = STEPS.findIndex((step) => step.id === get().currentStepId);
        if (idx > 0) {
          const previousStepId = STEPS[idx - 1].id;
          set({ currentStepId: previousStepId });
          mirrorOnboardingState(previousStepId, false);
        }
      },
      skipAllOptional: async () => {
        const { completedSteps, currentStepId } = get();
        const optionalIds = STEPS.filter((step) => !step.required).map((step) => step.id);
        const requiredDone = getUniqueSteps([
          ...deriveCompletedSteps(currentStepId),
          ...completedSteps,
        ]).filter((id) =>
          STEPS.find((step) => step.id === id && step.required)
        );
        set({ completedSteps: getUniqueSteps([...requiredDone, ...optionalIds]) });
        await get().complete();
      },
      skipForNow: async () => {
        const completedSteps = getUniqueSteps(get().completedSteps);
        const resumeStepId = getNextUnfinishedStepId(completedSteps);

        set({ currentStepId: resumeStepId, completedSteps, isComplete: true });
        mirrorOnboardingState(resumeStepId, true);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        logComplianceEvent('onboarding_complete', 'User skipped onboarding for now', 'info', { skipped: true }).catch(() => undefined);

        router.replace(DEFAULT_TAB_ROUTE);
      },
      complete: async () => {
        const { currentStepId, completedSteps } = get();
        const finalizedSteps = getUniqueSteps([...completedSteps, currentStepId]);

        set({ isComplete: true, completedSteps: finalizedSteps });
        mirrorOnboardingState(currentStepId, true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        apiRequest('/api/v1/onboarding/complete', { method: 'POST' }).catch(() => undefined);
        logComplianceEvent('onboarding_complete', 'User completed onboarding', 'info').catch(() => undefined);
        router.replace(DEFAULT_TAB_ROUTE);
      },
    }),
    {
      name: 'taxbridge:onboarding:v13',
      storage: createJSONStorage(() => zustandKvStorage),
      partialize: (state) => ({
        currentStepId: state.currentStepId,
        completedSteps: state.completedSteps,
        isComplete: state.isComplete,
        schemaVersion: state.schemaVersion,
      }),
      onRehydrateStorage: () => (state) => {
        state?.migrateIfNeeded();
        state?.markHydrated();
      },
    }
  )
);

export const useCurrentStepId = () => useOnboardingStore((state) => state.currentStepId);
export const useIsOnboardingDone = () => useOnboardingStore((state) => state.isComplete);
export const useOnboardingHydrated = () => useOnboardingStore((state) => state.hasHydrated);
export const useResumeStepId = () =>
  useOnboardingStore((state) => getNextUnfinishedStepId(state.completedSteps));
export const useProgressPercent = () =>
  useOnboardingStore((state) => {
    const requiredSteps = STEPS.filter((step) => step.required).length;
    const completedRequiredSteps = state.completedSteps.filter((id) =>
      STEPS.find((step) => step.id === id && step.required)
    ).length;
    return Math.round((completedRequiredSteps / requiredSteps) * 100);
  });
