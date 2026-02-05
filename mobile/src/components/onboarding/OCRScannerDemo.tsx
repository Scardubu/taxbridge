import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../../theme/tokens';

const SCANNER_ANIMATION = require('../../../assets/animations/scanner.json');

interface OCRScannerDemoProps {
  onNext: () => void;
  onSkip?: () => void;
  onLaunchScanner?: () => void;
}

const DEMO_STEPS = [
  {
    id: 'point',
    icon: 'camera-outline' as keyof typeof Ionicons.glyphMap,
    title: 'onboarding.scanner.step1Title',
    description: 'onboarding.scanner.step1Desc',
  },
  {
    id: 'extract',
    icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap,
    title: 'onboarding.scanner.step2Title',
    description: 'onboarding.scanner.step2Desc',
  },
  {
    id: 'review',
    icon: 'checkmark-done-outline' as keyof typeof Ionicons.glyphMap,
    title: 'onboarding.scanner.step3Title',
    description: 'onboarding.scanner.step3Desc',
  },
];

const DEMO_AMOUNTS = {
  receiptTotal: 15240.5,
  item1: 42500,
  item2: 8500,
  item3: 12750,
} as const;

/**
 * OCRScannerDemo Component
 * 
 * Demonstrates the receipt scanning workflow:
 * - Step-by-step visual guide
 * - Sample extracted data preview
 * - Permission rationale
 * - CTA to try live scanning
 */
export default function OCRScannerDemo({ 
  onNext, 
  onSkip,
  onLaunchScanner 
}: OCRScannerDemoProps) {
  const { t } = useTranslation();
  const [showExtractedData, setShowExtractedData] = useState(false);

  const formatCurrency = useCallback((amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const demoData = useMemo(() => ({
    vendor: t('onboarding.scanner.demo.vendor'),
    amount: formatCurrency(DEMO_AMOUNTS.receiptTotal),
    date: t('onboarding.scanner.demo.date'),
    items: [
      { name: t('onboarding.scanner.demo.item1'), price: formatCurrency(DEMO_AMOUNTS.item1) },
      { name: t('onboarding.scanner.demo.item2'), price: formatCurrency(DEMO_AMOUNTS.item2) },
      { name: t('onboarding.scanner.demo.item3'), price: formatCurrency(DEMO_AMOUNTS.item3) },
    ],
  }), [formatCurrency, t]);

  const handleTryScanning = useCallback(() => {
    if (onLaunchScanner) {
      onLaunchScanner();
    } else {
      // If no scanner available, just show demo data
      setShowExtractedData(true);
    }
  }, [onLaunchScanner]);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Animated Header */}
      <View style={styles.header}>
        <LottieView
          source={SCANNER_ANIMATION}
          autoPlay
          loop={true}
          style={styles.headerAnimation}
          speed={1.0}
        />
        <Text style={styles.title}>{t('onboarding.scanner.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.scanner.subtitle')}</Text>
      </View>

      {/* Visual Demo Steps */}
      <View style={styles.stepsContainer}>
        {DEMO_STEPS.map((step, index) => (
          <Animated.View
            key={step.id}
            style={styles.stepCard}
            entering={FadeInUp.delay(index * 100).springify()}
          >
            <View style={styles.stepIconContainer}>
              <Ionicons name={step.icon} size={32} color={colors.primary} />
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
            </View>
            
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t(step.title)}</Text>
              <Text style={styles.stepDescription}>{t(step.description)}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Sample Receipt Image Placeholder */}
      <View style={styles.receiptPreviewCard}>
        <View style={styles.receiptPlaceholder}>
          <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
          <Text style={styles.receiptPlaceholderText}>
            {t('onboarding.scanner.sampleReceipt')}
          </Text>
        </View>
      </View>

      {/* Extracted Data Preview */}
      {showExtractedData && (
        <Animated.View
          style={styles.extractedCard}
          entering={FadeIn}
        >
          <View style={styles.extractedHeader}>
            <Ionicons name="sparkles" size={20} color={colors.success} />
            <Text style={styles.extractedTitle}>{t('onboarding.scanner.extracted')}</Text>
          </View>

          <View style={styles.extractedData}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>{t('onboarding.scanner.vendor')}</Text>
              <View style={styles.dataValueContainer}>
                <Text style={styles.dataValue}>{demoData.vendor}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>95%</Text>
                </View>
              </View>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>{t('onboarding.scanner.amount')}</Text>
              <View style={styles.dataValueContainer}>
                <Text style={styles.dataValue}>{demoData.amount}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>88%</Text>
                </View>
              </View>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>{t('onboarding.scanner.date')}</Text>
              <View style={styles.dataValueContainer}>
                <Text style={styles.dataValue}>{demoData.date}</Text>
                <View style={[styles.confidenceBadge, styles.confidenceBadgeLow]}>
                  <Text style={styles.confidenceText}>72%</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.extractedHint}>
            {t('onboarding.scanner.reviewHint')}
          </Text>
        </Animated.View>
      )}

      {/* Benefits Section */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>{t('onboarding.scanner.benefits')}</Text>
        
        <View style={styles.benefitRow}>
          <Ionicons name="flash-outline" size={20} color={colors.info} />
          <Text style={styles.benefitText}>{t('onboarding.scanner.benefit1')}</Text>
        </View>

        <View style={styles.benefitRow}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          <Text style={styles.benefitText}>{t('onboarding.scanner.benefit2')}</Text>
        </View>

        <View style={styles.benefitRow}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
          <Text style={styles.benefitText}>{t('onboarding.scanner.benefit3')}</Text>
        </View>
      </View>

      {/* Permission Rationale */}
      <View style={styles.permissionCard}>
        <View style={styles.permissionHeader}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>{t('onboarding.scanner.privacy')}</Text>
        </View>
        <Text style={styles.permissionText}>{t('onboarding.scanner.privacyExplainer')}</Text>
      </View>

      {/* Try Scanning CTA */}
      {!showExtractedData && onLaunchScanner && (
        <TouchableOpacity
          style={styles.tryScanButton}
          onPress={handleTryScanning}
        >
          <Ionicons name="camera" size={20} color={colors.textOnPrimary} />
          <Text style={styles.tryScanButtonText}>{t('onboarding.scanner.tryScan')}</Text>
        </TouchableOpacity>
      )}

      {/* Navigation Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onNext}
        >
          <Text style={styles.continueButtonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
          >
            <Text style={styles.skipButtonText}>{t('onboarding.scanner.skipForNow')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerAnimation: {
    width: 160,
    height: 160,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xxl + 2,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  stepsContainer: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  stepIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    backgroundColor: colors.primaryBgSubtle,
    borderRadius: radii.lg,
  },
  stepNumber: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  receiptPreviewCard: {
    backgroundColor: colors.surfaceSlate,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  receiptPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  receiptPlaceholderText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  extractedCard: {
    backgroundColor: colors.successBgSubtle,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  extractedTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.success,
  },
  extractedData: {
    gap: spacing.md,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dataLabel: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    flex: 1,
  },
  dataValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 2,
    justifyContent: 'flex-end',
  },
  dataValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  confidenceBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  confidenceBadgeLow: {
    backgroundColor: colors.warning,
  },
  confidenceText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  extractedHint: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 16,
  },
  benefitsCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  benefitsTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  benefitText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  permissionCard: {
    backgroundColor: colors.surfaceSlate,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  permissionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  permissionText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  tryScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.info,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  tryScanButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  actions: {
    gap: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
});
