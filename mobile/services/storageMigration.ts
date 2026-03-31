import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppKV, zustandKvStorage } from '../storage/kv';
import { STEPS, migrateLegacyStepId, type StepId } from '../stores/onboardingStore';

const ONBOARDING_STORAGE_KEY = 'taxbridge:onboarding:v13';

function deriveCompletedSteps(currentStepId: StepId): StepId[] {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);
  if (currentIndex <= 0) {
    return [];
  }

  return STEPS.slice(0, currentIndex).map((step) => step.id);
}

export async function migrateFromAsyncStorage(): Promise<void> {
  if (AppKV.onboarding.isMigrated()) return;

  try {
    const existingState = await zustandKvStorage.getItem(ONBOARDING_STORAGE_KEY);
    const [step, done] = await Promise.all([
      AsyncStorage.getItem('onboarding_step'),
      AsyncStorage.getItem('onboarding_complete'),
    ]);

    const migratedStepId = migrateLegacyStepId(step ?? 'welcome');
    const isComplete = done === 'true';

    AppKV.onboarding.setStep(migratedStepId);
    AppKV.onboarding.setComplete(isComplete);

    if (!existingState && (step || done)) {
      await zustandKvStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({
          state: {
            currentStepId: migratedStepId,
            completedSteps: isComplete ? STEPS.map((currentStep) => currentStep.id) : deriveCompletedSteps(migratedStepId),
            isComplete,
            schemaVersion: 13,
          },
          version: 0,
        })
      );
    }

    AppKV.onboarding.markMigrated();

    await AsyncStorage.multiRemove([
      'onboarding_step',
      'onboarding_complete',
      'onboarding_fields',
      'onboarding_progress',
    ]);
  } catch {
    AppKV.onboarding.markMigrated();
  }
}
