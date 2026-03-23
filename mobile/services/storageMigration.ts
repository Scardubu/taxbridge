import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppKV } from '../storage/kv';
import { migrateLegacyStepId } from '../stores/onboardingStore';

export async function migrateFromAsyncStorage(): Promise<void> {
  if (AppKV.onboarding.isMigrated()) return;

  try {
    const [step, done] = await Promise.all([
      AsyncStorage.getItem('onboarding_step'),
      AsyncStorage.getItem('onboarding_complete'),
    ]);

    if (step) AppKV.onboarding.setStep(migrateLegacyStepId(step));
    if (done) AppKV.onboarding.setComplete(done === 'true');

    AppKV.onboarding.markMigrated();

    await AsyncStorage.multiRemove([
      'onboarding_step',
      'onboarding_complete',
      'onboarding_fields',
      'onboarding_progress',
    ]);
  } catch {}
}
