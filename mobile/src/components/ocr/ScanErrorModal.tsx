import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { Button } from '../Button';

export type ScanErrorType =
  | 'lowQuality'
  | 'noReceiptDetected'
  | 'lowConfidence'
  | 'timeout'
  | 'networkError';

interface ScanErrorModalProps {
  visible: boolean;
  errorType: ScanErrorType;
  onRetry: () => void;
  onManualEntry: () => void;
  onDismiss?: () => void;
}

interface ErrorConfig {
  icon: string;
  title: string;
  message: string;
  tips: string[];
}

/**
 * ScanErrorModal Component
 * 
 * Provides contextual error recovery guidance for OCR scan failures.
 * Shows actionable tips and clear next steps.
 */
export function ScanErrorModal({
  visible,
  errorType,
  onRetry,
  onManualEntry,
  onDismiss,
}: ScanErrorModalProps) {
  const { t } = useTranslation();

  const errorConfigs: Record<ScanErrorType, ErrorConfig> = {
    lowQuality: {
      icon: '📸',
      title: t('ocr.errors.lowQuality.title'),
      message: t('ocr.errors.lowQuality.message'),
      tips: [
        t('ocr.errors.lowQuality.tip1'),
        t('ocr.errors.lowQuality.tip2'),
        t('ocr.errors.lowQuality.tip3'),
      ],
    },
    noReceiptDetected: {
      icon: '📄',
      title: t('ocr.errors.noReceipt.title'),
      message: t('ocr.errors.noReceipt.message'),
      tips: [
        t('ocr.errors.noReceipt.tip1'),
        t('ocr.errors.noReceipt.tip2'),
        t('ocr.errors.noReceipt.tip3'),
      ],
    },
    lowConfidence: {
      icon: '⚠️',
      title: t('ocr.errors.lowConfidence.title'),
      message: t('ocr.errors.lowConfidence.message'),
      tips: [
        t('ocr.errors.lowConfidence.tip1'),
        t('ocr.errors.lowConfidence.tip2'),
        t('ocr.errors.lowConfidence.tip3'),
      ],
    },
    timeout: {
      icon: '⏱️',
      title: t('ocr.errors.timeout.title'),
      message: t('ocr.errors.timeout.message'),
      tips: [
        t('ocr.errors.timeout.tip1'),
        t('ocr.errors.timeout.tip2'),
        t('ocr.errors.timeout.tip3'),
      ],
    },
    networkError: {
      icon: '📡',
      title: t('ocr.errors.network.title'),
      message: t('ocr.errors.network.message'),
      tips: [
        t('ocr.errors.network.tip1'),
        t('ocr.errors.network.tip2'),
        t('ocr.errors.network.tip3'),
      ],
    },
  };

  const config = errorConfigs[errorType];

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  };

  const handleManualEntry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onManualEntry();
  };

  const handleDismiss = () => {
    if (onDismiss) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <Text style={styles.icon}>{config.icon}</Text>

            {/* Title */}
            <Text style={styles.title}>{config.title}</Text>

            {/* Message */}
            <Text style={styles.message}>{config.message}</Text>

            {/* Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>{t('ocr.errors.tryThese')}</Text>
              {config.tips.map((tip, index) => (
                <View key={index} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>✓</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                label={t('ocr.errors.retake')}
                onPress={handleRetry}
                variant="primary"
                fullWidth
              />
              
              <Button
                label={t('ocr.errors.manualEntry')}
                onPress={handleManualEntry}
                variant="outline"
                fullWidth
              />

              {onDismiss && (
                <Pressable onPress={handleDismiss} style={styles.dismissButton}>
                  <Text style={styles.dismissText}>{t('common.cancel')}</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...shadows.lg,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  
  // Icon
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  
  // Title & Message
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: typography.size.md * 1.5,
  },
  
  // Tips
  tipsContainer: {
    backgroundColor: colors.surfaceSlate,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xl,
  },
  tipsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tipBullet: {
    fontSize: typography.size.md,
    color: colors.success,
    fontWeight: typography.weight.bold,
  },
  tipText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * 1.4,
  },
  
  // Actions
  actions: {
    gap: spacing.md,
  },
  dismissButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
