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
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';

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
  const vatStatusText = vatStatus.statusCode === 'mandatory'
    ? t('onboarding.vatcit.mandatoryAt')
    : vatStatus.statusCode === 'approaching'
    ? t('onboarding.vatcit.alert')
    : t('onboarding.vatcit.vatThresholdDesc');
  const vatDisclaimerText = vatStatus.disclaimerCode === 'mandatory'
    ? t('onboarding.vatcit.mandatoryAt')
    : t('onboarding.vatcit.alertAction');
  const citRateDescription = citRate.descriptionCode === 'small'
    ? `${t('onboarding.vatcit.citSmall')} • ${t('onboarding.vatcit.citSmallRate')}`
    : citRate.descriptionCode === 'medium'
    ? `${t('onboarding.vatcit.citMedium')} • ${t('onboarding.vatcit.citMediumRate')}`
    : `${t('onboarding.vatcit.citLarge')} • ${t('onboarding.vatcit.citLargeRate')}`;

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
                    vatStatus.requiresRegistration ? styles.sliderFillError : styles.sliderFillSuccess,
                    {
                      width: `${Math.min(vatStatus.percentageOfThreshold, 100)}%`,
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
                vatStatus.requiresRegistration ? styles.statusBadgeError : styles.statusBadgeSuccess,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  vatStatus.requiresRegistration ? styles.statusTextError : styles.statusTextSuccess,
                ]}
              >
                {vatStatusText}
              </Text>
            </View>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
               ℹ️ {vatDisclaimerText}
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
                <View style={[styles.flowNode, styles.flowNodeSmall, styles.flowNodeInfoLight]}>
                    <Text style={styles.flowNodeTextSmall}>{t('onboarding.vatcit.soleProp')}</Text>
                  </View>
                  <View style={styles.flowArrow} />
                  <View style={[styles.flowNode, styles.flowNodeResult, styles.flowNodeSuccessLight]}>
                    <Text style={styles.flowNodeResultText}>PIT</Text>
                    <Text style={styles.flowNodeResultSubtext}>0-25%</Text>
                  </View>
                </View>
                
                <View style={styles.flowRight}>
                <View style={[styles.flowNode, styles.flowNodeSmall, styles.flowNodeWarningLight]}>
                    <Text style={styles.flowNodeTextSmall}>{t('onboarding.vatcit.incorporated')}</Text>
                  </View>
                  <View style={styles.flowArrow} />
                  <View style={[styles.flowNode, styles.flowNodeResult, styles.flowNodeCautionLight]}>
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
                <Text style={styles.statusCardDescription}>{citRateDescription}</Text>
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
    fontSize: typography.size.xxl + spacing.xxs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    lineHeight: spacing.xxl,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: spacing.xs + spacing.xxs,
  },
  tabLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xxs,
  },
  tabIcon: {
    fontSize: typography.size.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sliderContainer: {
    marginBottom: spacing.xl,
  },
  sliderTrack: {
    height: spacing.md,
    backgroundColor: colors.border,
    borderRadius: spacing.xs + spacing.xxs,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: spacing.xs + spacing.xxs,
  },
  sliderFillError: {
    backgroundColor: colors.error,
  },
  sliderFillSuccess: {
    backgroundColor: colors.success,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sliderLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  sliderMarker: {
    position: 'absolute',
    top: -spacing.sm,
    transform: [{ translateX: -(spacing.md) }],
    alignItems: 'center',
  },
  markerDot: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    borderWidth: spacing.xxs + spacing.xs,
    borderColor: colors.surface,
  },
  markerText: {
    fontSize: typography.size.xs - spacing.xxs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusBadgeError: {
    backgroundColor: colors.errorBg,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successBg,
  },
  statusText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  disclaimerText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    fontStyle: 'italic',
  },
  explanationBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  explanationTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  explanationText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
    lineHeight: spacing.xl,
    marginBottom: spacing.md,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletItem: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
    lineHeight: spacing.xl,
  },
  alertBox: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.md,
  },
  alertText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.warningDark,
    fontWeight: typography.weight.medium,
  },
  flowchart: {
    marginBottom: spacing.xl,
  },
  flowNode: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flowNodeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  flowNodeInfoLight: {
    backgroundColor: colors.primaryLight,
  },
  flowNodeSuccessLight: {
    backgroundColor: colors.successBg,
  },
  flowNodeWarningLight: {
    backgroundColor: colors.warningBg,
  },
  flowNodeCautionLight: {
    backgroundColor: colors.warningBgLight,
  },
  flowBranch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
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
    padding: spacing.md,
    width: '100%',
  },
  flowNodeTextSmall: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  flowArrow: {
    width: spacing.xxs,
    height: spacing.xl,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  flowNodeResult: {
    width: '100%',
  },
  flowNodeResultText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  flowNodeResultSubtext: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tableTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowData: {
    borderBottomWidth: 0,
  },
  tableCell: {
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  tableCellData: {
    flex: 1,
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textSecondary,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusCardTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  statusCardText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusCardDescription: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  quizCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  quizQuestion: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: spacing.xl,
  },
  quizOptions: {
    gap: spacing.sm,
  },
  quizOption: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizOptionSelected: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  quizOptionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  quizOptionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  quizOptionText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  quizFeedback: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  quizFeedbackText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textSecondary,
    lineHeight: spacing.xl,
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
    borderColor: colors.border,
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
    color: colors.surface,
  },
  timeEstimate: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
