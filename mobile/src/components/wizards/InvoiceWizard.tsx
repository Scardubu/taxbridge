import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { colors, radii, spacing, shadows, typography } from '../../theme/tokens';
import { trackEvent } from '../../services/analytics';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const STORAGE_KEY = 'tb_invoice_wizard_seen';

export default function InvoiceWizard() {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = useMemo<WizardStep[]>(
    () => [
      {
        id: 'customer',
        title: t('wizard.invoiceWizard.step1Title'),
        description: t('wizard.invoiceWizard.step1Desc'),
      },
      {
        id: 'items',
        title: t('wizard.invoiceWizard.step2Title'),
        description: t('wizard.invoiceWizard.step2Desc'),
      },
      {
        id: 'review',
        title: t('wizard.invoiceWizard.step3Title'),
        description: t('wizard.invoiceWizard.step3Desc'),
      },
    ],
    [t, i18n.language]
  );

  useEffect(() => {
    let mounted = true;
    const checkSeen = async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (!seen && mounted) {
          setVisible(true);
          void trackEvent('engagement', 'invoice_wizard_shown');
        }
      } catch {
        // If storage fails, avoid blocking the user
      }
    };

    void checkSeen();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const step = steps[currentStep];
    if (step) {
      void trackEvent('engagement', 'invoice_wizard_step', step.id, currentStep + 1);
    }
  }, [visible, currentStep, steps]);

  const completeWizard = useCallback(async (action: 'completed' | 'skipped') => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    void trackEvent('engagement', `invoice_wizard_${action}`);
    setVisible(false);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      void completeWizard('completed');
    }
  }, [currentStep, steps.length, completeWizard]);

  const handleSkip = useCallback(() => {
    void completeWizard('skipped');
  }, [completeWizard]);

  if (!visible) return null;

  const step = steps[currentStep];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <Card style={styles.card} variant="elevated" padding="lg">
          <Text variant="caption" style={styles.stepIndicator}>
            {t('wizard.step', { current: currentStep + 1, total: steps.length })}
          </Text>

          <Text variant="h3" style={styles.title}>
            {t('wizard.invoiceWizard.title')}
          </Text>

          <View style={styles.content}>
            <Text variant="h4" style={styles.stepTitle}>
              {step.title}
            </Text>
            <Text variant="body" style={styles.stepDescription}>
              {step.description}
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              label={t('wizard.skipStep')}
              variant="ghost"
              size="md"
              onPress={handleSkip}
              style={styles.actionButton}
            />
            <Button
              label={currentStep === steps.length - 1 ? t('wizard.finish') : t('wizard.next')}
              variant="primary"
              size="md"
              onPress={handleNext}
              style={styles.actionButton}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
  },
  stepIndicator: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  content: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.xs,
  },
  stepTitle: {
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  stepDescription: {
    color: colors.textSecondary,
    lineHeight: typography.body.lineHeight,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
