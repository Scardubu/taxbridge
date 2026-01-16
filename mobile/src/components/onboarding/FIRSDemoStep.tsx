import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
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
      console.error('Mock API error:', error);
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
              <ActivityIndicator size="large" color="#0B5FFF" />
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
  animationCard: {
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0B5FFF33',
  },
  animationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 20,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E4E7EC',
  },
  animationIconActive: {
    borderColor: '#0B5FFF',
    backgroundColor: '#EBF4FF',
  },
  animationEmoji: {
    fontSize: 28,
  },
  animationLabel: {
    fontSize: 11,
    color: '#667085',
    textAlign: 'center',
    fontWeight: '500',
  },
  animationArrow: {
    paddingHorizontal: 4,
  },
  animationArrowText: {
    fontSize: 20,
    color: '#0B5FFF',
    fontWeight: '700',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#667085',
    fontWeight: '500',
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
  endpointBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  endpointLabel: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 4,
    fontWeight: '500',
  },
  endpointValue: {
    fontSize: 13,
    color: '#0B5FFF',
    fontFamily: 'monospace',
  },
  endpointRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  endpointMethod: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  endpointPath: {
    fontSize: 12,
    color: '#344054',
    fontFamily: 'monospace',
    flex: 1,
  },
  noteBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
  },
  tryButton: {
    backgroundColor: '#0B5FFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  tryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  responseCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#16A34A',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 4,
  },
  responseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 16,
    marginTop: 20,
  },
  responseDetail: {
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 4,
    fontWeight: '500',
  },
  responseValue: {
    fontSize: 14,
    color: '#101828',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  qrCodeContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  qrCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 12,
  },
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  qrCodeImage: {
    width: 180,
    height: 180,
  },
  disclaimerBox: {
    marginTop: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#16A34A33',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 16,
    color: '#16A34A',
    fontWeight: '700',
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#344054',
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  infoText: {
    fontSize: 14,
    color: '#667085',
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
  continueButton: {
    flex: 1,
    backgroundColor: '#0B5FFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonFull: {
    flex: 1,
  },
  continueButtonText: {
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
