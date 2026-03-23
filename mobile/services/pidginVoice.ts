import * as Speech from 'expo-speech';
import { AppKV } from '../storage/kv';
import type { StepId } from '../stores/onboardingStore';

const STEP_HINTS: Record<StepId, string> = {
  'welcome':
    'Welcome to TaxBridge! We go help you manage your taxes without wahala. Select your language and make we start.',
  'business-type':
    'Tell us about your business. Whether you dey do trade alone or you get company, we go set up the right tax obligations for you.',
  'tin-verify':
    'Your Tax Identification Number — TIN — na your business identity for NRS. Without am, dem go cut ten percent from all the money wey people pay you. Enter am now so we go verify am.',
  'vat-setup':
    'VAT na seven point five percent wey you collect on top your invoices. If your turnover dey below one hundred million naira, you no need file VAT return every month. But you still need show the VAT on your invoices.',
  'einvoice':
    'E-invoice na the new law from NRS. Large businesses don start already. If your business big reach, make you connect now so you no get fine. We go show you your phase.',
  'community':
    'You don reach the last step! Share your compliance badge make your customers and partners know say you dey do business the right way. Welcome to the TaxBridge community!',
};

export async function speakPidginHint(text: string): Promise<void> {
  if (!AppKV.prefs.isVoiceEnabled()) return;
  await Speech.stop();
  await Speech.speak(text, { language: 'en-NG', pitch: 1, rate: 0.95 });
}

export async function speakStepHint(stepId: StepId): Promise<void> {
  const hint = STEP_HINTS[stepId];
  if (!hint) return;
  await speakPidginHint(hint);
}

export async function stopPidginVoice(): Promise<void> {
  await Speech.stop();
}
