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
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#667085',
    marginBottom: 24,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 16,
  },
  codeDisplay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0B5FFF',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0B5FFF',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: '#0B5FFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  benefitBox: {
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
    padding: 12,
  },
  benefitText: {
    fontSize: 13,
    color: '#344054',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 12,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  submitButton: {
    backgroundColor: '#0B5FFF',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D0D5DD',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successBadge: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
  },
  completionCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  completionEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667085',
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishButtonFull: {
    flex: 1,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeEstimate: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
});
