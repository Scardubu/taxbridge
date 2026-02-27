/**
 * TaxBridge — StreakScreen
 * M09 / F3 — Gamified Compliance Streak + XP
 *
 * Constraints:
 *   C-06  All strings from i18n (en + pidgin)
 *   C-07  Graceful degradation — shows defaults when SQLite is unavailable
 *   C-08  No Math.random — XP constants live in useStreak hook
 *   C-16  All durations use DURATION.* and EASE.* (no raw numbers)
 *
 * Architecture:
 *   Fully offline-first — cold start < 50ms via SQLite read in useStreak.
 *   Milestone banner (EASE.celebrate spring) appears once per milestone,
 *   dismissed by the user or automatically cleared by clearMilestone().
 *   The streak count hero animates a fire-pulse when today's checkin is confirmed.
 *
 * Gate:
 *   Cold start < 50ms (SQLite, no API call)
 *   Milestone confetti NOT shown when milestoneCelebrate = null
 *   Works fully offline (no network dependency)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStreak, type MilestoneDays } from '../../hooks/useStreak';
import { DURATION, EASE } from '../../design-system/animation';

// ─── Milestone config (deterministic — C-08, no Math.random) ─────────────────

const MILESTONE_CONFIG: Record<MilestoneDays, { i18nKey: string; emoji: string }> = {
  7:   { i18nKey: 'gamification.daysMilestone7',   emoji: '🎯' },
  30:  { i18nKey: 'gamification.daysMilestone30',  emoji: '🏆' },
  100: { i18nKey: 'gamification.daysMilestone100', emoji: '👑' },
};

// ─── Lagos date helper (mirrors useStreak — C-08)  ────────────────────────────

function lagosDateISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
  }).format(new Date());
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StreakScreen() {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  const {
    currentStreak,
    longestStreak,
    totalXP,
    lastCheckin,
    isLoading,
    milestoneCelebrate,
    clearMilestone,
  } = useStreak();

  // ── Milestone banner: scale-in with EASE.celebrate on new milestone ────────
  const milestoneScale = useSharedValue(0);
  const milestoneFired = useRef(false);

  useEffect(() => {
    if (milestoneCelebrate && !milestoneFired.current) {
      milestoneFired.current = true;
      milestoneScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(
          DURATION.fast,
          withTiming(1, { duration: DURATION.standard, easing: EASE.celebrate }),
        ),
      );
    } else if (!milestoneCelebrate) {
      milestoneFired.current = false;
      milestoneScale.value   = withTiming(0, { duration: DURATION.instant });
    }
  }, [milestoneCelebrate]);

  const milestoneAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: milestoneScale.value }],
    opacity:   milestoneScale.value,
  }));

  // ── Fire emoji pulse when today is confirmed ────────────────────────────────
  const fireScale      = useSharedValue(1);
  const checkedInToday = lastCheckin === lagosDateISO();

  useEffect(() => {
    if (checkedInToday) {
      fireScale.value = withSequence(
        withTiming(1.3, { duration: DURATION.fast,     easing: EASE.celebrate }),
        withTiming(1,   { duration: DURATION.standard, easing: EASE.enter }),
      );
    }
  }, [checkedInToday]);

  const fireAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  // ── Loading state (C-07: never throws) ────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  const milestone    = milestoneCelebrate ? MILESTONE_CONFIG[milestoneCelebrate] : null;
  const statusText   = checkedInToday
    ? t('gamification.keepGoing')
    : t('gamification.streakBroken');
  const statusColor  = checkedInToday ? colors.success : colors.warning;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Milestone Banner ───────────────────────────────────────────────── */}
      {milestoneCelebrate != null && milestone != null && (
        <Animated.View
          style={[
            styles.milestoneBanner,
            {
              backgroundColor: colors.primaryBgSubtle,
              borderColor:     colors.primaryBorder,
            },
            milestoneAStyle,
          ]}
        >
          <Text style={styles.milestoneEmoji}>{milestone.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.milestoneTitle, { color: colors.primary }]}>
              {t('gamification.milestoneTitle')}
            </Text>
            <Text style={[styles.milestoneDay, { color: colors.textSecondary }]}>
              {t(milestone.i18nKey)}
            </Text>
          </View>
          <Pressable
            onPress={clearMilestone}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
            hitSlop={8}
          >
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Hero — Fire + Streak Count ─────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(DURATION.standard).easing(EASE.enter)}
        style={[
          styles.hero,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Animated.Text style={[styles.fireEmoji, fireAStyle]}>🔥</Animated.Text>
        <Text
          style={[styles.streakCount, { color: colors.textPrimary }]}
          accessibilityLabel={`${currentStreak} ${t('gamification.days')}`}
        >
          {currentStreak}
        </Text>
        <Text style={[styles.streakUnit, { color: colors.textSecondary }]}>
          {t('gamification.currentStreak')} · {t('gamification.days')}
        </Text>
        <Text style={[styles.statusLine, { color: statusColor }]}>
          {statusText}
        </Text>
      </Animated.View>

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(DURATION.fast).duration(DURATION.standard).easing(EASE.enter)}
        style={styles.statsRow}
      >
        <StatCard
          emoji="🏅"
          value={String(longestStreak)}
          suffix={t('gamification.days')}
          label={t('gamification.longestStreak')}
          colors={colors}
        />
        <StatCard
          emoji="⚡"
          value={String(totalXP)}
          suffix="XP"
          label={t('gamification.totalXP')}
          colors={colors}
        />
      </Animated.View>

      {/* ── Description Card ─────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(DURATION.standard).duration(DURATION.standard).easing(EASE.enter)}
        style={[
          styles.descCard,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.descText, { color: colors.textSecondary }]}>
          {t('gamification.streakDesc')}
        </Text>
      </Animated.View>

    </ScrollView>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  emoji:  string;
  value:  string;
  suffix: string;
  label:  string;
  colors: any;
}

function StatCard({ emoji, value, suffix, label, colors }: StatCardProps) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>
        {value}{' '}
        <Text style={[styles.statSuffix, { color: colors.textMuted }]}>{suffix}</Text>
      </Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap:     16,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },

  // Milestone Banner
  milestoneBanner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    padding:       14,
    borderRadius:  12,
    borderWidth:   1,
  },
  milestoneEmoji: {
    fontSize: 28,
  },
  milestoneTitle: {
    fontSize:   14,
    fontWeight: '700',
  },
  milestoneDay: {
    fontSize:  12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
  },

  // Hero
  hero: {
    alignItems:   'center',
    padding:      28,
    borderRadius: 16,
    borderWidth:  1,
    gap:          6,
  },
  fireEmoji: {
    fontSize: 48,
  },
  streakCount: {
    fontSize:    72,
    fontWeight:  '800',
    lineHeight:  80,
    fontVariant: ['tabular-nums'],
  },
  streakUnit: {
    fontSize:   14,
    fontWeight: '500',
  },
  statusLine: {
    fontSize:   13,
    fontWeight: '600',
    marginTop:  4,
    textAlign:  'center',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap:           12,
  },
  statCard: {
    flex:           1,
    alignItems:     'center',
    padding:        16,
    borderRadius:   12,
    borderWidth:    1,
    gap:            4,
  },
  statEmoji: {
    fontSize: 22,
  },
  statValue: {
    fontSize:    22,
    fontWeight:  '700',
    fontVariant: ['tabular-nums'],
  },
  statSuffix: {
    fontSize:   13,
    fontWeight: '400',
  },
  statLabel: {
    fontSize:        11,
    textAlign:       'center',
    textTransform:   'uppercase',
    letterSpacing:   0.6,
  },

  // Description
  descCard: {
    padding:      16,
    borderRadius: 12,
    borderWidth:  1,
  },
  descText: {
    fontSize:   13,
    lineHeight: 20,
  },
});
