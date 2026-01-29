import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

export default function CommunityStep({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const { completeOnboarding } = useOnboarding();
  
  const [referralCode, setReferralCode] = useState('');
  const [hasEnteredCode, setHasEnteredCode] = useState(false);

  const generateReferralCode = () => {
    const code = `TAX${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    return code;
  };

  const [userReferralCode] = useState(generateReferralCode());

  const handleSubmitCode = () => {
    if (referralCode.trim()) {
      setHasEnteredCode(true);
      Alert.alert(
        t('onboarding.community.success'),
        t('onboarding.community.successMessage'),
        [{ text: t('onboarding.community.ok') }]
      );
    }
  };

  const handleShareCode = () => {
    Alert.alert(
      t('onboarding.community.shareTitle'),
      t('onboarding.community.shareMessage', { code: userReferralCode }),
      [
        { text: t('onboarding.community.cancel'), style: 'cancel' },
        {
          text: t('onboarding.community.copy'),
          onPress: () => {
            Alert.alert(t('onboarding.community.copied'));
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('onboarding.community.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.community.subtitle')}</Text>

      {/* Referral Code Display */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎁 {t('onboarding.community.yourCode')}</Text>
        
        <View style={styles.codeDisplay}>
          <Text style={styles.codeText}>{userReferralCode}</Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
          <Text style={styles.shareButtonText}>{t('onboarding.community.shareCode')}</Text>
        </TouchableOpacity>

        <View style={styles.benefitBox}>
          <Text style={styles.benefitText}>
            {t('onboarding.community.referralBenefit')}
          </Text>
        </View>
      </View>

      {/* Enter Referral Code */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✍️ {t('onboarding.community.enterCode')}</Text>
        
        <Text style={styles.inputLabel}>{t('onboarding.community.enterCodeDesc')}</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="TAXABC123"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            maxLength={10}
          />
          <TouchableOpacity
            style={[styles.submitButton, !referralCode.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmitCode}
            disabled={!referralCode.trim()}
          >
            <Text style={styles.submitButtonText}>{t('onboarding.community.apply')}</Text>
          </TouchableOpacity>
        </View>

        {hasEnteredCode && (
          <View style={styles.successBadge}>
            <Text style={styles.successText}>✓ {t('onboarding.community.codeApplied')}</Text>
          </View>
        )}
      </View>

      {/* Community Features */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👥 {t('onboarding.community.features')}</Text>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>💬</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{t('onboarding.community.telegram')}</Text>
            <Text style={styles.featureDescription}>
              {t('onboarding.community.telegramDesc')}
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📱</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{t('onboarding.community.whatsapp')}</Text>
            <Text style={styles.featureDescription}>
              {t('onboarding.community.whatsappDesc')}
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📚</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{t('onboarding.community.resources')}</Text>
            <Text style={styles.featureDescription}>
              {t('onboarding.community.resourcesDesc')}
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🤝</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>{t('onboarding.community.support')}</Text>
            <Text style={styles.featureDescription}>
              {t('onboarding.community.supportDesc')}
            </Text>
          </View>
        </View>
      </View>

      {/* Completion Card */}
      <View style={styles.completionCard}>
        <Text style={styles.completionEmoji}>🎉</Text>
        <Text style={styles.completionTitle}>{t('onboarding.community.congrats')}</Text>
        <Text style={styles.completionText}>{t('onboarding.community.congratsText')}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.finishButton, !onSkip && styles.finishButtonFull]}
          onPress={onNext}
        >
          <Text style={styles.finishButtonText}>{t('onboarding.community.getStarted')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.timeEstimate}>⏱️ {t('onboarding.community.timeEstimate')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  codeDisplay: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  codeText: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold as any,
    color: colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shareButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    color: colors.textOnPrimary,
  },
  benefitBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  benefitText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    fontFamily: 'monospace',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    color: colors.textOnPrimary,
  },
  successBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
  },
  successText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    color: colors.successDark,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureIcon: {
    fontSize: typography.size.xl,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  featureDescription: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  completionCard: {
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.successDark,
  },
  completionEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  completionTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  completionText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skipButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
    color: colors.textMuted,
  },
  finishButton: {
    flex: 1,
    backgroundColor: colors.successDark,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  finishButtonFull: {
    flex: 1,
  },
  finishButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
    color: colors.textOnPrimary,
  },
  timeEstimate: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
