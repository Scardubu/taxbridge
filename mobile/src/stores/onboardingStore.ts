import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandKvStorage } from '../storage/kv';

export const ONBOARDING_STEPS = {
  welcome: 'welcome',
  businessType: 'business-type',
  tinVerify: 'tin-verify',
  vatSetup: 'vat-setup',
  einvoice: 'einvoice',
  community: 'community',
} as const;

export type OnboardingStepId =
  (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

const STEP_CONFIG: Record<
  OnboardingStepId,
  { id: OnboardingStepId; title: string; optional: boolean; order: number }
> = {
  [ONBOARDING_STEPS.welcome]: {
    id: ONBOARDING_STEPS.welcome,
    title: 'Welcome to TaxBridge',
    optional: false,
    order: 0,
  },
  [ONBOARDING_STEPS.businessType]: {
    id: ONBOARDING_STEPS.businessType,
    title: 'Business Type',
    optional: false,
    order: 1,
  },
  [ONBOARDING_STEPS.tinVerify]: {
    id: ONBOARDING_STEPS.tinVerify,
    title: 'TIN Verification',
    optional: false,
    order: 2,
  },
  [ONBOARDING_STEPS.vatSetup]: {
    id: ONBOARDING_STEPS.vatSetup,
    title: 'VAT Setup',
    optional: true,
    order: 3,
  },
  [ONBOARDING_STEPS.einvoice]: {
    id: ONBOARDING_STEPS.einvoice,
    title: 'E-Invoicing',
    optional: true,
    order: 4,
  },
  [ONBOARDING_STEPS.community]: {
    id: ONBOARDING_STEPS.community,
    title: 'Community',
    optional: true,
    order: 5,
  },
};

const LEGACY_STEP_MAP: Record<string, OnboardingStepId> = {
  pit: ONBOARDING_STEPS.tinVerify,
  vatcit: ONBOARDING_STEPS.vatSetup,
  nrs: ONBOARDING_STEPS.einvoice,
};

interface OnboardingState {
  currentStepId: OnboardingStepId | null;
  completedSteps: OnboardingStepId[];
  isDone: boolean;
  isLoading: boolean;
  setCurrentStep: (stepId: OnboardingStepId) => void;
  markStepCompleted: (stepId: OnboardingStepId) => void;
  goNext: () => Promise<void>;
  goPrev: () => void;
  skipAllOptional: () => void;
  reset: () => void;
  complete: () => void;
}

function addUniqueStep(steps: OnboardingStepId[], stepId: OnboardingStepId): OnboardingStepId[] {
  return steps.includes(stepId) ? steps : [...steps, stepId];
}

function normalizePersistedSteps(steps: unknown): OnboardingStepId[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  const normalized: OnboardingStepId[] = [];
  steps.forEach((step) => {
    if (typeof step !== 'string') {
      return;
    }
    const mapped = LEGACY_STEP_MAP[step] ?? (Object.values(ONBOARDING_STEPS).includes(step as OnboardingStepId)
      ? (step as OnboardingStepId)
      : null);
    if (mapped && !normalized.includes(mapped)) {
      normalized.push(mapped);
    }
  });
  return normalized;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStepId: null,
      completedSteps: [],
      isDone: false,
      isLoading: false,

      setCurrentStep: (stepId) => {
        set({ currentStepId: stepId });
      },

      markStepCompleted: (stepId) => {
        set((state) => ({
          completedSteps: addUniqueStep(state.completedSteps, stepId),
        }));
      },

      goNext: async () => {
        const state = get();
        if (!state.currentStepId) {
          return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const completedSteps = addUniqueStep(state.completedSteps, state.currentStepId);
        const currentConfig = STEP_CONFIG[state.currentStepId];
        const nextStep = Object.values(STEP_CONFIG)
          .filter((config) => config.order > currentConfig.order)
          .sort((left, right) => left.order - right.order)[0];

        if (nextStep) {
          set({
            currentStepId: nextStep.id,
            completedSteps,
          });
          return;
        }

        set({
          currentStepId: null,
          completedSteps,
          isDone: true,
        });
      },

      goPrev: () => {
        const state = get();
        if (!state.currentStepId) {
          return;
        }

        const currentConfig = STEP_CONFIG[state.currentStepId];
        const prevStep = Object.values(STEP_CONFIG)
          .filter((config) => config.order < currentConfig.order)
          .sort((left, right) => right.order - left.order)[0];

        if (prevStep) {
          set({ currentStepId: prevStep.id });
        }
      },

      skipAllOptional: () => {
        const optionalSteps = Object.values(STEP_CONFIG)
          .filter((config) => config.optional)
          .map((config) => config.id);

        set((state) => ({
          completedSteps: Array.from(new Set([...state.completedSteps, ...optionalSteps])),
        }));
      },

      reset: () => {
        set({
          currentStepId: null,
          completedSteps: [],
          isDone: false,
          isLoading: false,
        });
      },

      complete: () => {
        set({
          currentStepId: null,
          isDone: true,
        });
      },
    }),
    {
      name: 'onboarding-store',
      storage: createJSONStorage(() => zustandKvStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        state.completedSteps = normalizePersistedSteps(state.completedSteps);

        if (typeof state.currentStepId === 'string') {
          const mapped = LEGACY_STEP_MAP[state.currentStepId] ?? state.currentStepId;
          state.currentStepId = Object.values(ONBOARDING_STEPS).includes(mapped as OnboardingStepId)
            ? (mapped as OnboardingStepId)
            : null;
        } else {
          state.currentStepId = null;
        }
      },
      version: 1,
    }
  )
);

export const useCurrentStepId = () => useOnboardingStore((state) => state.currentStepId);
export const useIsOnboardingDone = () => useOnboardingStore((state) => state.isDone);
export const useProgressPercent = () => {
  const completedSteps = useOnboardingStore((state) => state.completedSteps);
  const totalSteps = Object.keys(STEP_CONFIG).length;
  return Math.round((completedSteps.length / totalSteps) * 100);
};
export const useStepConfig = () =>
  useOnboardingStore((state) => (state.currentStepId ? STEP_CONFIG[state.currentStepId] : null));
export const useIsStepCompleted = (stepId: OnboardingStepId) =>
  useOnboardingStore((state) => state.completedSteps.includes(stepId));

export const getStepProgress = (stepId: OnboardingStepId): number => {
  const config = STEP_CONFIG[stepId];
  return ((config.order + 1) / Object.keys(STEP_CONFIG).length) * 100;
};

export const isStepAccessible = (
  stepId: OnboardingStepId,
  completedSteps: OnboardingStepId[]
): boolean => {
  const config = STEP_CONFIG[stepId];
  if (config.order === 0) {
    return true;
  }

  const prevStep = Object.values(STEP_CONFIG).find((candidate) => candidate.order === config.order - 1);
  return prevStep ? completedSteps.includes(prevStep.id) : false;
};
