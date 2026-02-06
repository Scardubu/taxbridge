import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import {
  stampInvoiceMock,
  generateSampleInvoice,
  getMockAPIEndpoints,
  type MockStampResponse,
} from '../../services/mockFIRS';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

export default function FIRSDemoStep({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const { unlockAchievement } = useOnboarding();
  
  const [isLoading, setIsLoading] = useState(false);
  const [stampResponse, setStampResponse] = useState<MockStampResponse | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);

  const handleTryMockAPI = async () => {
    setIsLoading(true);
    setShowAnimation(true);

    try {
      // Generate sample invoice
      const sampleInvoice = generateSampleInvoice();

      // Call mock API
      const response = await stampInvoiceMock(sampleInvoice);

      setStampResponse(response);
      await unlockAchievement('firs_explorer');
    } catch (error) {
      if (__DEV__) console.error('Mock API error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mockEndpoints = getMockAPIEndpoints();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('onboarding.firs.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.firs.subtitle')}</Text>

      {/* Animation */}
      {showAnimation && !stampResponse && (
        <View style={styles.animationCard}>
          <Text style={styles.animationTitle}>🎬 {t('onboarding.firs.animation')}</Text>
          <View style={styles.animationFlow}>
            <View style={styles.animationStep}>
              <View style={styles.animationIcon}>
                <Text style={styles.animationEmoji}>📄</Text>
              </View>
              <Text style={styles.animationLabel}>{t('onboarding.firs.step1')}</Text>
            </View>
            
            <View style={styles.animationArrow}>
              <Text style={styles.animationArrowText}>→</Text>
            </View>

            <View style={styles.animationStep}>
              <View style={[styles.animationIcon, isLoading && styles.animationIconActive]}>
                <Text style={styles.animationEmoji}>🌐</Text>
              </View>
              <Text style={styles.animationLabel}>{t('onboarding.firs.step2')}</Text>
            </View>

            <View style={styles.animationArrow}>
              <Text style={styles.animationArrowText}>→</Text>
            </View>

            <View style={styles.animationStep}>
              <View style={styles.animationIcon}>
                <Text style={styles.animationEmoji}>✅</Text>
              </View>
              <Text style={styles.animationLabel}>{t('onboarding.firs.step3')}</Text>
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <SkeletonLoader type="inline-lg" count={1} />
              <Text style={styles.loadingText}>{t('onboarding.firs.processing')}</Text>
            </View>
          )}
        </View>
      )}

      {/* API Endpoints Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔌 {t('onboarding.firs.apiEndpoints')}</Text>
        
        <View style={styles.endpointBox}>
          <Text style={styles.endpointLabel}>{t('onboarding.firs.baseUrl')}</Text>
          <Text style={styles.endpointValue}>{mockEndpoints.baseURL}</Text>
        </View>

        {Object.entries(mockEndpoints.endpoints).map(([key, value]) => (
          <View key={key} style={styles.endpointRow}>
            <Text style={styles.endpointMethod}>{value.split(' ')[0]}</Text>
            <Text style={styles.endpointPath}>{value.split(' ')[1]}</Text>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>ℹ️ {mockEndpoints.note}</Text>
        </View>
      </View>

      {/* Try Mock API Button */}
      {!stampResponse && (
        <TouchableOpacity
          style={styles.tryButton}
          onPress={handleTryMockAPI}
          disabled={isLoading}
        >
          <Text style={styles.tryButtonText}>
            {isLoading ? t('onboarding.firs.processing') : t('onboarding.firs.tryApi')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stamp Response */}
      {stampResponse && (
        <View style={styles.responseCard}>
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>{t('onboarding.firs.demoWatermark')}</Text>
          </View>

          <Text style={styles.responseTitle}>✅ {t('onboarding.firs.stampSuccess')}</Text>

          <View style={styles.responseDetail}>
            <Text style={styles.responseLabel}>{t('onboarding.firs.stampCode')}</Text>
            <Text style={styles.responseValue}>{stampResponse.stampCode}</Text>
          </View>

          <View style={styles.responseDetail}>
            <Text style={styles.responseLabel}>{t('onboarding.firs.irn')}</Text>
            <Text style={styles.responseValue}>{stampResponse.irn}</Text>
          </View>

          <View style={styles.responseDetail}>
            <Text style={styles.responseLabel}>{t('onboarding.firs.timestamp')}</Text>
            <Text style={styles.responseValue}>
              {new Date(stampResponse.timestamp).toLocaleString()}
            </Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrCodeContainer}>
            <Text style={styles.qrCodeLabel}>{t('onboarding.firs.qrCode')}</Text>
            <View style={styles.qrCodeBox}>
              <Image
                source={{ uri: stampResponse.qrCode }}
                style={styles.qrCodeImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>{stampResponse.disclaimer}</Text>
          </View>
        </View>
      )}

      {/* Benefits */}
      <View style={styles.benefitsCard}>
        <Text style={styles.cardTitle}>💡 {t('onboarding.firs.benefits')}</Text>
        
        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>✓</Text>
          <Text style={styles.benefitText}>{t('onboarding.firs.benefit1')}</Text>
        </View>
        
        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>✓</Text>
          <Text style={styles.benefitText}>{t('onboarding.firs.benefit2')}</Text>
        </View>
        
        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>✓</Text>
          <Text style={styles.benefitText}>{t('onboarding.firs.benefit3')}</Text>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>✓</Text>
          <Text style={styles.benefitText}>{t('onboarding.firs.benefit4')}</Text>
        </View>
      </View>

      {/* Penalties Warning */}
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>⚠️ {t('onboarding.firs.penalties')}</Text>
        <Text style={styles.warningText}>{t('onboarding.firs.penaltiesText')}</Text>
      </View>

      {/* When to Use */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>🎯 {t('onboarding.firs.whenToUse')}</Text>
        <Text style={styles.infoText}>{t('onboarding.firs.whenToUseText')}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.continueButton, !onSkip && styles.continueButtonFull]}
          onPress={onNext}
        >
          <Text style={styles.continueButtonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.timeEstimate}>⏱️ {t('onboarding.firs.timeEstimate')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.xxl + 2,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  animationCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  animationTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  animationFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  animationStep: {
    alignItems: 'center',
    flex: 1,
  },
  animationIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  animationIconActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  animationEmoji: {
    fontSize: 28,
  },
  animationLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: typography.weight.medium,
  },
  animationArrow: {
    paddingHorizontal: spacing.xs,
  },
  animationArrowText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  loadingContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  endpointBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  endpointLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  endpointValue: {
    fontSize: typography.size.sm - 1,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  endpointRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  endpointMethod: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.success,
    marginRight: spacing.sm,
    fontFamily: 'monospace',
  },
  endpointPath: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  noteBox: {
    backgroundColor: colors.actionOrangeBg,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: {
    fontSize: typography.size.xs,
    color: colors.warningDark,
    fontStyle: 'italic',
  },
  tryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  tryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  responseCard: {
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.brandGreen600,
    position: 'relative',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.6,
  },
  watermarkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.error,
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm / 2,
  },
  responseTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.brandGreen600,
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  },
  responseDetail: {
    marginBottom: spacing.md,
  },
  responseLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  responseValue: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: typography.weight.semibold,
  },
  qrCodeContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  qrCodeLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  qrCodeBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  qrCodeImage: {
    width: 180,
    height: 180,
  },
  disclaimerBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.errorBg,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.errorDark,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: colors.actionGreenBg,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  benefitIcon: {
    fontSize: typography.size.md,
    color: colors.brandGreen600,
    fontWeight: typography.weight.bold,
    marginRight: spacing.md,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.warningDark,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: typography.size.sm,
    color: colors.tipText,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  infoText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skipButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  continueButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  continueButtonFull: {
    flex: 1,
  },
  continueButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
  timeEstimate: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
