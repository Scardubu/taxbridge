import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { DURATION } from '../../design-system/animation';

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

interface Anomaly {
  type: string;
  severity: Severity;
  message: string;
  expenseId?: string;
}

interface TaxPrediction {
  revenue: number;
  predictions: {
    vat: { amount: number; dueDate: string; rate: number };
    cit: { amount: number; dueDate: string; rate: number };
    devLevy: { amount: number; dueDate: string; rate: number };
    total: number;
  };
  recommendations: string[];
}

interface CashFlowRisk {
  score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

const T = {
  green: '#10B981',
  greenDark: '#059669',
  greenLight: '#D1FAE5',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  slate800: '#1E293B',
  slate600: '#475569',
  slate400: '#94A3B8',
  slate100: '#F1F5F9',
  white: '#FFFFFF',
};

const SEVERITY_CONFIG: Record<Severity, { bg: string; text: string; label: string; emoji: string }> = {
  HIGH:   { bg: T.redLight,   text: T.red,   label: 'HIGH',   emoji: '🔴' },
  MEDIUM: { bg: T.amberLight, text: T.amber, label: 'MEDIUM', emoji: '🟡' },
  LOW:    { bg: T.greenLight, text: T.green, label: 'LOW',    emoji: '🟢' },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: target, duration, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    return () => anim.removeListener(id);
  }, [target]);

  return value;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: DURATION.standard, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: DURATION.standard, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function RiskGauge({ score, risk }: { score: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const width = useRef(new Animated.Value(0)).current;
  const counted = useCountUp(score, 1000);

  const color = risk === 'LOW' ? T.green : risk === 'MEDIUM' ? T.amber : T.red;

  useEffect(() => {
    Animated.spring(width, {
      toValue: score,
      useNativeDriver: false,
      tension: 30,
      friction: 8,
    }).start();
  }, [score]);

  return (
    <View style={styles.gaugeWrapper}>
      <View style={styles.gaugeRow}>
        <Text style={styles.gaugeLabel}>Cash Flow Risk</Text>
        <View style={[styles.riskBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.riskBadgeText, { color }]}>{risk}</Text>
        </View>
      </View>
      <View style={styles.gaugeTrack}>
        <Animated.View
          style={[
            styles.gaugeFill,
            {
              backgroundColor: color,
              width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <View style={styles.gaugeFootRow}>
        <Text style={styles.gaugeFootLabel}>Low risk</Text>
        <Text style={[styles.gaugeScore, { color }]}>{counted}</Text>
        <Text style={styles.gaugeFootLabel}>High risk</Text>
      </View>
    </View>
  );
}

function TaxPill({
  label,
  amount,
  dueDate,
  rate,
}: {
  label: string;
  amount: number;
  dueDate: string;
  rate: number;
}) {
  const formatted = amount > 0 ? `₦${amount.toLocaleString('en-NG')}` : '₦0';
  const due = new Date(dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  const urgent = daysLeft <= 7;

  return (
    <View style={[styles.taxPill, urgent && styles.taxPillUrgent]}>
      <Text style={styles.taxPillLabel}>{label}</Text>
      <Text style={styles.taxPillRate}>{(rate * 100).toFixed(1)}%</Text>
      <Text style={styles.taxPillAmount}>{formatted}</Text>
      <View style={[styles.taxPillDue, urgent && { backgroundColor: T.red + '22' }]}>
        <Text style={[styles.taxPillDueText, urgent && { color: T.red }]}>
          {urgent ? `⚠️ ${daysLeft}d` : `Due ${due}`}
        </Text>
      </View>
    </View>
  );
}

function AnomalyCard({ anomaly, index }: { anomaly: Anomaly; index: number }) {
  const cfg = SEVERITY_CONFIG[anomaly.severity];
  const scale = useRef(new Animated.Value(0.96)).current;

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  return (
    <FadeIn delay={index * 60}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <Animated.View
          style={[
            styles.anomalyCard,
            { borderLeftColor: cfg.text, transform: [{ scale }] },
          ]}
        >
          <View style={styles.anomalyHeader}>
            <Text style={styles.anomalyEmoji}>{cfg.emoji}</Text>
            <View style={[styles.severityBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.severityText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.anomalyType}>{anomaly.type.replace(/_/g, ' ')}</Text>
          </View>
          <Text style={styles.anomalyMessage}>{anomaly.message}</Text>
        </Animated.View>
      </TouchableOpacity>
    </FadeIn>
  );
}

function RecommendationItem({ text, index }: { text: string; index: number }) {
  return (
    <FadeIn delay={index * 80}>
      <View style={styles.recRow}>
        <View style={styles.recDot} />
        <Text style={styles.recText}>{text}</Text>
      </View>
    </FadeIn>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<TaxPrediction | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [cashflow, setCashflow] = useState<CashFlowRisk | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

  const load = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const [predRes, anomRes, cashRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/insights/tax-prediction`).then((r) => r.json()),
        fetch(`${API}/api/v1/insights/anomalies`).then((r) => r.json()),
        fetch(`${API}/api/v1/insights/cashflow-risk`).then((r) => r.json()),
      ]);

      if (predRes.status === 'fulfilled') setPrediction(predRes.value);
      if (anomRes.status === 'fulfilled') setAnomalies(anomRes.value?.anomalies ?? []);
      if (cashRes.status === 'fulfilled') setCashflow(cashRes.value);
    } catch (e) {
      setError('Could not load insights. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.green} />
        <Text style={styles.loadingText}>Analyzing your finances…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <FadeIn>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Tax Intelligence</Text>
            <Text style={styles.headerSub}>Powered by your transaction data</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              load(true);
            }}
          >
            <Text style={styles.refreshIcon}>{refreshing ? '⏳' : '↻'}</Text>
          </TouchableOpacity>
        </View>
      </FadeIn>

      {/* ── Cash Flow Risk ── */}
      {cashflow && (
        <FadeIn delay={80}>
          <View style={styles.card}>
            {cashflow.factors.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Risk Factors</Text>
                {cashflow.factors.map((f, i) => (
                  <Text key={i} style={styles.riskFactor}>• {f}</Text>
                ))}
                <View style={styles.divider} />
              </>
            )}
            <RiskGauge score={cashflow.score} risk={cashflow.risk} />
          </View>
        </FadeIn>
      )}

      {/* ── Tax Predictions ── */}
      {prediction && (
        <FadeIn delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Upcoming Tax Liabilities</Text>
            <Text style={styles.revenueNote}>
              Based on ₦{prediction.revenue.toLocaleString('en-NG')} quarterly revenue
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
              <TaxPill
                label="VAT" rate={prediction.predictions.vat.rate}
                amount={prediction.predictions.vat.amount}
                dueDate={prediction.predictions.vat.dueDate}
              />
              <TaxPill
                label="CIT" rate={prediction.predictions.cit.rate}
                amount={prediction.predictions.cit.amount}
                dueDate={prediction.predictions.cit.dueDate}
              />
              <TaxPill
                label="Dev Levy" rate={prediction.predictions.devLevy.rate}
                amount={prediction.predictions.devLevy.amount}
                dueDate={prediction.predictions.devLevy.dueDate}
              />
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Estimated Tax</Text>
              <Text style={styles.totalAmount}>
                ₦{prediction.predictions.total.toLocaleString('en-NG')}
              </Text>
            </View>
          </View>
        </FadeIn>
      )}

      {/* ── Smart Recommendations ── */}
      {(prediction?.recommendations?.length ?? 0) > 0 && (
        <FadeIn delay={240}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💡 Smart Recommendations</Text>
            {prediction!.recommendations.map((rec, i) => (
              <RecommendationItem key={i} text={rec} index={i} />
            ))}
          </View>
        </FadeIn>
      )}

      {/* ── Anomalies ── */}
      <FadeIn delay={320}>
        <View style={styles.card}>
          <View style={styles.anomalyHeader2}>
            <Text style={styles.cardTitle}>⚠️ Anomaly Detection</Text>
            {anomalies.length > 0 && (
              <View style={styles.anomalyCountBadge}>
                <Text style={styles.anomalyCountText}>{anomalies.length}</Text>
              </View>
            )}
          </View>

          {anomalies.length === 0 ? null : (
            <View style={styles.anomalyList}>
              {anomalies.map((a, i) => (
                <AnomalyCard key={i} anomaly={a} index={i} />
              ))}
            </View>
          )}
        </View>
      </FadeIn>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingTop: Platform.OS === 'ios' ? 56 : 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: T.slate400, fontSize: 14, marginTop: 8 },
  errorEmoji: { fontSize: 40 },
  errorText: { color: T.slate600, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 8, backgroundColor: T.green, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: T.white, fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16, paddingHorizontal: 4,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: T.greenLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.slate800 },
  headerSub: { fontSize: 12, color: T.slate400, marginTop: 1 },
  refreshBtn: { marginLeft: 'auto', padding: 8 },
  refreshIcon: { fontSize: 20, color: T.slate400 },

  card: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.slate800, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: T.slate400, textTransform: 'uppercase', marginBottom: 8 },
  divider: { height: 1, backgroundColor: T.slate100, marginVertical: 14 },

  gaugeWrapper: { gap: 8 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gaugeLabel: { fontSize: 13, fontWeight: '700', color: T.slate600 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  gaugeTrack: { height: 10, backgroundColor: T.slate100, borderRadius: 5, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 5 },
  gaugeFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gaugeFootLabel: { fontSize: 10, color: T.slate400 },
  gaugeScore: { fontSize: 22, fontWeight: '900' },
  riskFactor: { fontSize: 13, color: T.slate600, marginBottom: 4, lineHeight: 20 },

  revenueNote: { fontSize: 12, color: T.slate400, marginBottom: 12, marginTop: -4 },
  pillsRow: { marginHorizontal: -4, marginBottom: 14 },
  taxPill: {
    width: 120, borderRadius: 16, padding: 14, marginHorizontal: 4,
    backgroundColor: T.slate100, alignItems: 'center', gap: 4,
  },
  taxPillUrgent: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA' },
  taxPillLabel: { fontSize: 12, fontWeight: '800', color: T.slate600 },
  taxPillRate: { fontSize: 11, color: T.slate400 },
  taxPillAmount: { fontSize: 16, fontWeight: '900', color: T.slate800 },
  taxPillDue: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: T.greenLight, marginTop: 2 },
  taxPillDueText: { fontSize: 10, fontWeight: '700', color: T.greenDark },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: T.slate100,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: T.slate600 },
  totalAmount: { fontSize: 20, fontWeight: '900', color: T.greenDark },

  recRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.green, marginTop: 6, flexShrink: 0 },
  recText: { flex: 1, fontSize: 13, color: T.slate600, lineHeight: 20 },

  anomalyHeader2: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  anomalyCountBadge: {
    marginLeft: 8, backgroundColor: T.red, borderRadius: 99,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  anomalyCountText: { color: T.white, fontSize: 11, fontWeight: '800' },
  anomalyList: { gap: 10 },
  anomalyCard: {
    borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 10,
    paddingRight: 12, backgroundColor: '#FAFAFA', borderRadius: 12,
  },
  anomalyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  anomalyEmoji: { fontSize: 14 },
  severityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  severityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  anomalyType: { fontSize: 11, color: T.slate400, textTransform: 'capitalize' },
  anomalyMessage: { fontSize: 13, color: T.slate800, lineHeight: 19 },

  allClear: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  allClearEmoji: { fontSize: 36 },
  allClearTitle: { fontSize: 15, fontWeight: '800', color: T.greenDark },
  allClearSub: { fontSize: 12, color: T.slate400, marginTop: 2 },
});
