import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

export default function GamificationStep({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const { achievements, preferences, updatePreferences } = useOnboarding();
  const [enableGamification, setEnableGamification] = useState(preferences.enableGamification);
  const [enableLeaderboard, setEnableLeaderboard] = useState(preferences.enableLeaderboard);
  const [enableReminders, setEnableReminders] = useState(preferences.enableReminders);

  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;
  const totalCount = achievements.length;

  const handleContinue = async () => {
    await updatePreferences({
      enableGamification,
      enableLeaderboard,
      enableReminders,
    });
    onNext();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('onboarding.gamification.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.gamification.subtitle')}</Text>

      {/* Achievements Preview */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 {t('onboarding.gamification.achievements')}</Text>
        
        <View style={styles.progressBar}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(unlockedCount / totalCount) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {unlockedCount} / {totalCount} {t('onboarding.gamification.unlocked')}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsScroll}>
          {achievements.map((achievement) => (
            <View
              key={achievement.id}
              style={[
                styles.achievementCard,
                achievement.unlockedAt && styles.achievementCardUnlocked,
              ]}
            >
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.achievementDescription} numberOfLines={2}>
                {achievement.description}
              </Text>
              {achievement.unlockedAt && (
                <View style={styles.unlockedBadge}>
                  <Text style={styles.unlockedText}>✓ {t('onboarding.gamification.unlocked')}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Feature Toggles */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ {t('onboarding.gamification.preferences')}</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>{t('onboarding.gamification.enableGamification')}</Text>
            <Text style={styles.toggleDescription}>
              {t('onboarding.gamification.enableGamificationDesc')}
            </Text>
          </View>
          <Switch
            value={enableGamification}
            onValueChange={setEnableGamification}
            trackColor={{ false: '#E4E7EC', true: '#0B5FFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {enableGamification && (
          <>
            <View style={[styles.toggleRow, styles.toggleRowIndented]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>
                  {t('onboarding.gamification.enableLeaderboard')}
                </Text>
                <Text style={styles.toggleDescription}>
                  {t('onboarding.gamification.enableLeaderboardDesc')}
                </Text>
              </View>
              <Switch
                value={enableLeaderboard}
                onValueChange={setEnableLeaderboard}
                trackColor={{ false: '#E4E7EC', true: '#0B5FFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.toggleRow, styles.toggleRowIndented]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>
                  {t('onboarding.gamification.enableReminders')}
                </Text>
                <Text style={styles.toggleDescription}>
                  {t('onboarding.gamification.enableRemindersDesc')}
                </Text>
              </View>
              <Switch
                value={enableReminders}
                onValueChange={setEnableReminders}
                trackColor={{ false: '#E4E7EC', true: '#0B5FFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </>
        )}
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>🔒 {t('onboarding.gamification.privacy')}</Text>
        <Text style={styles.privacyText}>{t('onboarding.gamification.privacyText')}</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • {t('onboarding.gamification.privacyBullet1')}
          </Text>
          <Text style={styles.bulletItem}>
            • {t('onboarding.gamification.privacyBullet2')}
          </Text>
          <Text style={styles.bulletItem}>
            • {t('onboarding.gamification.privacyBullet3')}
          </Text>
        </View>
      </View>

      {/* Streak Mechanics */}
      {enableGamification && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 {t('onboarding.gamification.streaks')}</Text>
          
          <View style={styles.streakPreview}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakCount}>0 {t('onboarding.gamification.days')}</Text>
              <Text style={styles.streakLabel}>{t('onboarding.gamification.currentStreak')}</Text>
            </View>
          </View>

          <Text style={styles.streakDescription}>
            {t('onboarding.gamification.streakDesc')}
          </Text>
        </View>
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

      <Text style={styles.timeEstimate}>⏱️ {t('onboarding.gamification.timeEstimate')}</Text>
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
  progressBar: {
    marginBottom: 20,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E4E7EC',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0B5FFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    fontWeight: '500',
  },
  achievementsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  achievementCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    opacity: 0.6,
  },
  achievementCardUnlocked: {
    borderColor: '#0B5FFF',
    opacity: 1,
  },
  achievementIcon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#101828',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 10,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 14,
  },
  unlockedBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
  },
  unlockedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  toggleRowIndented: {
    paddingLeft: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#667085',
    lineHeight: 16,
  },
  privacyCard: {
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0B5FFF33',
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 12,
  },
  privacyText: {
    fontSize: 14,
    color: '#344054',
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
  },
  streakPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  streakEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
  },
  streakLabel: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
  },
  streakDescription: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
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
