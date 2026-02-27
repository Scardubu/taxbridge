import React, { useMemo, useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DURATION } from '../design-system/animation';

// ─── NTA 2025 Deadline Definitions ──────────────────────────────────────────

interface TaxDeadline {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  getNextDue: (from: Date) => Date;
  description: string;
}

const NTA_2025_DEADLINES: TaxDeadline[] = [
  {
    id: 'vat',
    name: 'VAT Filing',
    shortName: 'VAT',
    emoji: '🧾',
    description: 'File VAT returns for previous month',
    getNextDue: (from) => {
      const d = new Date(from);
      d.setDate(21);
      if (d <= from) d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  {
    id: 'paye',
    name: 'PAYE Remittance',
    shortName: 'PAYE',
    emoji: '👷',
    description: 'Remit employee income tax to LIRS/SIRS',
    getNextDue: (from) => {
      const d = new Date(from);
      d.setDate(10);
      if (d <= from) d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  {
    id: 'wht',
    name: 'WHT Remittance',
    shortName: 'WHT',
    emoji: '🏦',
    description: 'Withholding tax remittance to NRS (State/Federal)',
    getNextDue: (from) => {
      const d = new Date(from);
      d.setDate(21);
      if (d <= from) d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  {
    id: 'cit',
    name: 'CIT / TET',
    shortName: 'CIT',
    emoji: '🏢',
    description: 'Companies Income Tax annual return',
    getNextDue: (from) => {
      const d = new Date(from.getFullYear(), 5, 30); // June 30
      if (d <= from) d.setFullYear(d.getFullYear() + 1);
      return d;
    },
  },
];

// ─── Urgency helpers ─────────────────────────────────────────────────────────

function getDaysLeft(due: Date): number {
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
}

interface UrgencyStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  badgeText: string;
  label: string;
}

function getUrgency(days: number): UrgencyStyle {
  if (days <= 3) {
    return {
      bg: '#FFF5F5', border: '#FCA5A5', text: '#DC2626',
      badge: '#EF4444', badgeText: '#fff', label: 'URGENT',
    };
  }
  if (days <= 7) {
    return {
      bg: '#FFF7ED', border: '#FDBA74', text: '#EA580C',
      badge: '#F97316', badgeText: '#fff', label: 'SOON',
    };
  }
  if (days <= 14) {
    return {
      bg: '#FFFBEB', border: '#FCD34D', text: '#D97706',
      badge: '#F59E0B', badgeText: '#fff', label: 'UPCOMING',
    };
  }
  return {
    bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D',
    badge: '#10B981', badgeText: '#fff', label: 'ON TRACK',
  };
}

// ─── Single deadline card ────────────────────────────────────────────────────

function DeadlineCard({
  deadline,
  animDelay,
}: {
  deadline: TaxDeadline;
  animDelay: number;
}) {
  const due = useMemo(() => deadline.getNextDue(new Date()), []);
  const days = getDaysLeft(due);
  const urgency = getUrgency(days);

  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: DURATION.entrance, delay: animDelay, useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1, delay: animDelay, useNativeDriver: true, tension: 80, friction: 8,
      }),
    ]).start();
  }, []);

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const dateStr = due.toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: urgency.bg,
            borderColor: urgency.border,
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <Text style={styles.emoji}>{deadline.emoji}</Text>
          <View style={styles.cardInfo}>
            <Text style={[styles.taxName, { color: urgency.text }]}>
              {deadline.name}
            </Text>
            <Text style={styles.description}>{deadline.description}</Text>
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: urgency.badge }]}>
            <Text style={[styles.urgencyLabel, { color: urgency.badgeText }]}>
              {urgency.label}
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.dueLabel}>Due date</Text>
            <Text style={[styles.dueDate, { color: urgency.text }]}>{dateStr}</Text>
          </View>
          <View style={styles.countdownPill}>
            <Text style={[styles.countdownNumber, { color: urgency.text }]}>{days}</Text>
            <Text style={styles.countdownDays}>days</Text>
          </View>
        </View>

        {/* Urgency bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: urgency.badge,
                width: `${Math.max(5, Math.min(100, 100 - (days / 30) * 100))}%`,
              },
            ]}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Widget header ───────────────────────────────────────────────────────────

function NextDeadlineBanner() {
  const next = useMemo(() => {
    const all = NTA_2025_DEADLINES.map((d) => ({
      ...d,
      due: d.getNextDue(new Date()),
    })).sort((a, b) => a.due.getTime() - b.due.getTime());
    return all[0];
  }, []);

  const days = getDaysLeft(next.due);
  const urgency = getUrgency(days);

  return (
    <View style={[styles.banner, { backgroundColor: urgency.bg, borderColor: urgency.border }]}>
      <Text style={styles.bannerEmoji}>{next.emoji}</Text>
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: urgency.text }]}>
          Next: {next.shortName} in {days} day{days !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.bannerSub}>
          {next.getNextDue(new Date()).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'long',
          })}
        </Text>
      </View>
      <View style={[styles.bannerBadge, { backgroundColor: urgency.badge }]}>
        <Text style={styles.bannerBadgeText}>{days}d</Text>
      </View>
    </View>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export function DeadlineWidget({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <NextDeadlineBanner />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Tax Deadlines</Text>
        <Text style={styles.headerSub}>NTA 2025 Schedule</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {NTA_2025_DEADLINES.map((deadline, i) => (
          <View key={deadline.id} style={styles.cardWrapper}>
            <DeadlineCard deadline={deadline} animDelay={i * 80} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  headerSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  scrollContent: { paddingHorizontal: 16, gap: 10 },
  cardWrapper: { width: 240 },

  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emoji: { fontSize: 22, marginTop: 2 },
  cardInfo: { flex: 1 },
  taxName: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  description: { fontSize: 11, color: '#64748B', lineHeight: 15 },
  urgencyBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 99, alignSelf: 'flex-start',
  },
  urgencyLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dueLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  dueDate: { fontSize: 13, fontWeight: '700' },
  countdownPill: { alignItems: 'center' },
  countdownNumber: { fontSize: 28, fontWeight: '900', lineHeight: 30 },
  countdownDays: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  progressTrack: {
    height: 4, backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  // Compact banner variant
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bannerEmoji: { fontSize: 20 },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 13, fontWeight: '800' },
  bannerSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  bannerBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  bannerBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
