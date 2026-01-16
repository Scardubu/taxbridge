import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { checkVATThreshold, checkCITRate } from '../../utils/taxCalculator';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

export default function VATCITAwarenessStep({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const { profile, unlockAchievement } = useOnboarding();
  const [activeTab, setActiveTab] = useState<'vat' | 'cit'>('vat');
  const [quizAnswerVAT, setQuizAnswerVAT] = useState<string | null>(null);
  const [quizAnswerCIT, setQuizAnswerCIT] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const turnover = profile.annualTurnover || 0;
  const vatStatus = checkVATThreshold(turnover);
  const citRate = checkCITRate(turnover);

  const handleQuizAnswer = (type: 'vat' | 'cit', answer: string) => {
    if (type === 'vat') {
      setQuizAnswerVAT(answer);
      if (answer === 'b') {
        unlockAchievement('vat_aware');
      }
    } else {
      setQuizAnswerCIT(answer);
      if (answer === 'a') {
        unlockAchievement('cit_explorer');
      }
    }
    setShowFeedback(true);
  };

  const handleContinue = () => {
    onNext();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('onboarding.vatcit.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.vatcit.subtitle')}</Text>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vat' && styles.tabActive]}
          onPress={() => {
            setActiveTab('vat');
            setShowFeedback(false);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'vat' }}
        >
          <View style={styles.tabLabel}>
            <Text style={styles.tabIcon}>💼</Text>
            <Text style={[styles.tabText, activeTab === 'vat' && styles.tabTextActive]}>
              {t('onboarding.vatcit.vatTab')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cit' && styles.tabActive]}
          onPress={() => {
            setActiveTab('cit');
            setShowFeedback(false);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'cit' }}
        >
          <View style={styles.tabLabel}>
            <Text style={styles.tabIcon}>🏢</Text>
            <Text style={[styles.tabText, activeTab === 'cit' && styles.tabTextActive]}>
              {t('onboarding.vatcit.citTab')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* VAT Content */}
      {activeTab === 'vat' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('onboarding.vatcit.vatThreshold')}</Text>
            
            {/* Slider Visual */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    {
                      width: `${Math.min(vatStatus.percentageOfThreshold, 100)}%`,
                      backgroundColor: vatStatus.requiresRegistration ? '#DC2626' : '#10B981',
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>₦0</Text>
                <Text style={styles.sliderLabel}>₦100M</Text>
              </View>
              <View
                style={[
                  styles.sliderMarker,
                  { left: `${Math.min(vatStatus.percentageOfThreshold, 100)}%` },
                ]}
              >
                <View style={styles.markerDot} />
                <Text style={styles.markerText}>₦{(turnover / 1_000_000).toFixed(1)}M</Text>
              </View>
            </View>

            {/* Status Message */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: vatStatus.requiresRegistration ? '#FEE2E2' : '#DCFCE7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: vatStatus.requiresRegistration ? '#DC2626' : '#16A34A',
                  },
                ]}
              >
                {vatStatus.status}
              </Text>
            </View>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
               ℹ️ {vatStatus.disclaimer}
            </Text>

            {/* Explanation */}
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>📖 {t('onboarding.vatcit.howItWorks')}</Text>
              <Text style={styles.explanationText}>
                {t('onboarding.vatcit.vatExplanation')}
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.vatBullet1')}</Text>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.vatBullet2')}</Text>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.vatBullet3')}</Text>
              </View>
            </View>

            {/* Alert if approaching */}
            {turnover >= 80_000_000 && !vatStatus.requiresRegistration && (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠️ {t('onboarding.vatcit.vatAlert')}
                </Text>
              </View>
            )}
          </View>

          {/* VAT Quiz */}
          <View style={styles.quizCard}>
            <Text style={styles.cardTitle}>❓ {t('onboarding.vatcit.quiz')}</Text>
            <Text style={styles.quizQuestion}>{t('onboarding.vatcit.vatQuizQuestion')}</Text>
            
            <View style={styles.quizOptions}>
              {[
                { value: 'a', label: t('onboarding.vatcit.vatQuizA'), isCorrect: false },
                { value: 'b', label: t('onboarding.vatcit.vatQuizB'), isCorrect: true },
                { value: 'c', label: t('onboarding.vatcit.vatQuizC'), isCorrect: false },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.quizOption,
                    quizAnswerVAT === option.value && styles.quizOptionSelected,
                    showFeedback && option.isCorrect && styles.quizOptionCorrect,
                    showFeedback &&
                      quizAnswerVAT === option.value &&
                      !option.isCorrect &&
                      styles.quizOptionWrong,
                  ]}
                  onPress={() => handleQuizAnswer('vat', option.value)}
                  disabled={showFeedback}
                >
                  <Text style={styles.quizOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showFeedback && (
              <View style={styles.quizFeedback}>
                <Text style={styles.quizFeedbackText}>
                  {quizAnswerVAT === 'b'
                    ? t('onboarding.vatcit.quizCorrect')
                    : t('onboarding.vatcit.quizWrong')}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* CIT Content */}
      {activeTab === 'cit' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('onboarding.vatcit.citVsPit')}</Text>
            
            {/* Flowchart */}
            <View style={styles.flowchart}>
              <View style={styles.flowNode}>
                <Text style={styles.flowNodeText}>{t('onboarding.vatcit.businessEntity')}</Text>
              </View>
              
              <View style={styles.flowBranch}>
                <View style={styles.flowLeft}>
                  <View style={[styles.flowNode, styles.flowNodeSmall, { backgroundColor: '#EBF4FF' }]}>
                    <Text style={styles.flowNodeTextSmall}>{t('onboarding.vatcit.soleProp')}</Text>
                  </View>
                  <View style={styles.flowArrow} />
                  <View style={[styles.flowNode, styles.flowNodeResult, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={styles.flowNodeResultText}>PIT</Text>
                    <Text style={styles.flowNodeResultSubtext}>0-25%</Text>
                  </View>
                </View>
                
                <View style={styles.flowRight}>
                  <View style={[styles.flowNode, styles.flowNodeSmall, { backgroundColor: '#FFF7ED' }]}>
                    <Text style={styles.flowNodeTextSmall}>{t('onboarding.vatcit.incorporated')}</Text>
                  </View>
                  <View style={styles.flowArrow} />
                  <View style={[styles.flowNode, styles.flowNodeResult, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={styles.flowNodeResultText}>CIT</Text>
                    <Text style={styles.flowNodeResultSubtext}>0-30%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* CIT Rate Table */}
            <View style={styles.tableContainer}>
              <Text style={styles.tableTitle}>{t('onboarding.vatcit.citRates')}</Text>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>{t('onboarding.vatcit.turnover')}</Text>
                <Text style={styles.tableCell}>{t('onboarding.vatcit.rate')}</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowData]}>
                <Text style={styles.tableCellData}>≤ ₦50M</Text>
                <Text style={styles.tableCellData}>0%</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowData]}>
                <Text style={styles.tableCellData}>₦50-100M</Text>
                <Text style={styles.tableCellData}>20%</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowData]}>
                <Text style={styles.tableCellData}>{'>'} ₦100M</Text>
                <Text style={styles.tableCellData}>30%</Text>
              </View>
            </View>

            {/* Current Status */}
            {turnover > 0 && (
              <View style={styles.statusCard}>
                <Text style={styles.statusCardTitle}>{t('onboarding.vatcit.yourStatus')}</Text>
                <Text style={styles.statusCardText}>
                  {t('onboarding.vatcit.currentTurnover')}: ₦{turnover.toLocaleString()}
                </Text>
                <Text style={styles.statusCardText}>
                  {t('onboarding.vatcit.citRate')}: {citRate.rate * 100}%
                </Text>
                <Text style={styles.statusCardDescription}>{citRate.description}</Text>
              </View>
            )}

            {/* Key Differences */}
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>🔑 {t('onboarding.vatcit.keyDifferences')}</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.citBullet1')}</Text>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.citBullet2')}</Text>
                <Text style={styles.bulletItem}>• {t('onboarding.vatcit.citBullet3')}</Text>
              </View>
            </View>
          </View>

          {/* CIT Quiz */}
          <View style={styles.quizCard}>
            <Text style={styles.cardTitle}>❓ {t('onboarding.vatcit.quiz')}</Text>
            <Text style={styles.quizQuestion}>{t('onboarding.vatcit.citQuizQuestion')}</Text>
            
            <View style={styles.quizOptions}>
              {[
                { value: 'a', label: t('onboarding.vatcit.citQuizA'), isCorrect: true },
                { value: 'b', label: t('onboarding.vatcit.citQuizB'), isCorrect: false },
                { value: 'c', label: t('onboarding.vatcit.citQuizC'), isCorrect: false },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.quizOption,
                    quizAnswerCIT === option.value && styles.quizOptionSelected,
                    showFeedback && option.isCorrect && styles.quizOptionCorrect,
                    showFeedback &&
                      quizAnswerCIT === option.value &&
                      !option.isCorrect &&
                      styles.quizOptionWrong,
                  ]}
                  onPress={() => handleQuizAnswer('cit', option.value)}
                  disabled={showFeedback}
                >
                  <Text style={styles.quizOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showFeedback && (
              <View style={styles.quizFeedback}>
                <Text style={styles.quizFeedbackText}>
                  {quizAnswerCIT === 'a'
                    ? t('onboarding.vatcit.quizCorrect')
                    : t('onboarding.vatcit.quizWrong')}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.continueButton, !onSkip && styles.continueButtonFull]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.timeEstimate}>⏱️ {t('onboarding.vatcit.timeEstimate')}</Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667085',
  },
  tabTextActive: {
    color: '#0B5FFF',
    fontWeight: '600',
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
  sliderContainer: {
    marginBottom: 20,
  },
  sliderTrack: {
    height: 12,
    backgroundColor: '#E4E7EC',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 6,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '500',
  },
  sliderMarker: {
    position: 'absolute',
    top: -8,
    transform: [{ translateX: -12 }],
    alignItems: 'center',
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0B5FFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0B5FFF',
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  explanationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 20,
  },
  alertBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginTop: 12,
  },
  alertText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  flowchart: {
    marginBottom: 20,
  },
  flowNode: {
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  flowNodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5FFF',
  },
  flowBranch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flowLeft: {
    flex: 1,
    alignItems: 'center',
  },
  flowRight: {
    flex: 1,
    alignItems: 'center',
  },
  flowNodeSmall: {
    padding: 12,
    width: '100%',
  },
  flowNodeTextSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#344054',
    textAlign: 'center',
  },
  flowArrow: {
    width: 2,
    height: 20,
    backgroundColor: '#D0D5DD',
    marginVertical: 8,
  },
  flowNodeResult: {
    width: '100%',
  },
  flowNodeResultText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'center',
  },
  flowNodeResultSubtext: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
    textAlign: 'center',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  tableRowData: {
    borderBottomWidth: 0,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },
  tableCellData: {
    flex: 1,
    fontSize: 13,
    color: '#344054',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 8,
  },
  statusCardText: {
    fontSize: 13,
    color: '#344054',
    marginBottom: 4,
  },
  statusCardDescription: {
    fontSize: 12,
    color: '#667085',
    marginTop: 8,
    fontStyle: 'italic',
  },
  quizCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B33',
  },
  quizQuestion: {
    fontSize: 14,
    color: '#344054',
    marginBottom: 16,
    lineHeight: 20,
  },
  quizOptions: {
    gap: 8,
  },
  quizOption: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  quizOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFF7ED',
  },
  quizOptionCorrect: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  quizOptionWrong: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  quizOptionText: {
    fontSize: 14,
    color: '#344054',
    fontWeight: '500',
  },
  quizFeedback: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  quizFeedbackText: {
    fontSize: 13,
    color: '#344054',
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
