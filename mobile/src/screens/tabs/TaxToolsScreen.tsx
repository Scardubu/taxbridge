/**
 * TaxBridge Tax Tools Screen
 * PIT, VAT, CIT, PAYE, WHT, CGT calculators — NTA 2025 compliant
 * Live computation, breakdown visualization, compliance calendar
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ActiveTaxGuideScreen from '../TaxGuideScreen';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import { DURATION, STAGGER } from '../../design-system/animation';
import { Card, NairaInput, Button, Badge, ProgressBar } from '../../design-system/components';
import { TaxTooltip } from '../../components/education/TaxEducation';
import {
  PIT_BRACKETS,
  VAT_RATE,
  CIT_TIERS,
  CGT_RATE,
  DEVELOPMENT_LEVY_RATE,
  WHT_RATES,
  PENSION_RATE,
  NHF_RATE,
  RENT_RELIEF_CAP,
  RENT_RELIEF_RATE,
} from '@taxbridge/contracts';

// ─── NTA 2025 Constants — imported from @taxbridge/contracts (C-09) ──────────
// RULE 4: All rates come from canonical constants. Never hardcode.
// PIT_BRACKETS, VAT_RATE, CIT_TIERS, CGT_RATE, WHT_RATES imported above.

/** Human-readable labels for WHT payment type keys */
const WHT_LABELS: Record<string, string> = {
  contractServices: 'Contract Services',
  professionalFees: 'Professional Fees',
};
function whtLabel(key: string): string {
  return WHT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

type CalcType = 'pit' | 'vat' | 'cit' | 'paye' | 'wht' | 'cgt';

// ─── Calculator Logic ─────────────────────────────────────────────────────────

/**
 * calcPIT — uses NTA 2025 bands from @taxbridge/contracts.
 * RULE 3: CRA is abolished. Uses RRA (Rent Relief Allowance) instead.
 * RULE 4: All rates from PIT_BRACKETS constant.
 * Pass rentPaid=0 for users who don't pay rent.
 */
function calcPIT(annualIncome: number, rentPaid: number = 0): {
  taxable: number; total: number; effectiveRate: number;
  bands: Array<{ label: string; rate: number; taxOnBand: number; bandIncome: number }>;
  rra: number; pension: number; nhf: number;
} {
  // Statutory deductions
  const pension = annualIncome * PENSION_RATE;
  const nhf     = annualIncome * NHF_RATE;
  // RRA replaces CRA — min(20% × rent, ₦500k). NTA 2025 §30(2)
  const rra     = rentPaid > 0 ? Math.min(RENT_RELIEF_CAP, rentPaid * RENT_RELIEF_RATE) : 0;
  const taxable = Math.max(0, annualIncome - pension - nhf - rra);

  let remaining = taxable;
  let total     = 0;
  let prevLimit = 0;
  const bands: Array<{ label: string; rate: number; taxOnBand: number; bandIncome: number }> = [];

  for (const band of PIT_BRACKETS) {
    const width = band.limit === Infinity ? remaining : Math.min(remaining, band.limit - prevLimit);
    if (width <= 0) break;
    const taxOnBand = width * band.rate;
    total          += taxOnBand;
    bands.push({ label: band.label, rate: band.rate, taxOnBand, bandIncome: width });
    remaining      -= width;
    prevLimit       = band.limit;
    if (remaining <= 0) break;
  }

  return { taxable, total, effectiveRate: annualIncome > 0 ? total / annualIncome : 0, bands, rra, pension, nhf };
}

function calcCIT(profit: number): { rate: number; tax: number; tier: string; devLevy: number } {
  // C-09: CIT tiers from @taxbridge/contracts, never hardcoded
  const matched = CIT_TIERS.find(t => profit <= t.maxRevenue) ?? CIT_TIERS[CIT_TIERS.length - 1];
  const rate = matched.rate;
  const tier = profit <= CIT_TIERS[0].maxRevenue ? 'small'
             : profit <= CIT_TIERS[1].maxRevenue ? 'medium' : 'large';
  const exempt = tier === 'small';
  return { rate, tax: exempt ? 0 : profit * rate, tier, devLevy: exempt ? 0 : profit * DEVELOPMENT_LEVY_RATE };
}

function calcPAYE(grossMonthly: number): {
  gross: number; rra: number; taxable: number;
  paye: number; pension: number; nhf: number; net: number;
} {
  const annual  = grossMonthly * 12;
  const pension = grossMonthly * PENSION_RATE;
  const nhf     = grossMonthly * NHF_RATE;
  const pit     = calcPIT(annual);
  const paye    = pit.total / 12;
  return {
    gross: grossMonthly, rra: pit.rra / 12, taxable: pit.taxable / 12,
    paye, pension, nhf, net: grossMonthly - paye - pension - nhf,
  };
}

// ─── Tools Screen ─────────────────────────────────────────────────────────────

const CALC_TABS: { id: CalcType; label: string; emoji: string }[] = [
  { id: 'pit',  label: 'PIT',  emoji: '💼' },
  { id: 'vat',  label: 'VAT',  emoji: '🧾' },
  { id: 'cit',  label: 'CIT',  emoji: '🏢' },
  { id: 'paye', label: 'PAYE', emoji: '👥' },
  { id: 'wht',  label: 'WHT',  emoji: '🔂' },
  { id: 'cgt',  label: 'CGT',  emoji: '₿' },
];

export default function TaxToolsScreen() {
  return <ActiveTaxGuideScreen />;
}

// ─── PIT Calculator ───────────────────────────────────────────────────────────

function PITCalc() {
  const { t } = useTranslation();
  const [income, setIncome] = useState<number>(0);
  const result = useMemo(() => income > 0 ? calcPIT(income) : null, [income]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="pit">
          <Text>{t('tools.pitCalc')}</Text>
        </TaxTooltip>
        {' '}— NTA 2025 §1-40
      </Text>
      <NairaInput
        label={t('tools.annualIncome')}
        value={income || undefined}
        onChangeText={(raw: number) => setIncome(raw)}
        placeholder="3,000,000"
        hint="Enter your total annual income before deductions"
        required
      />

      {result && (
        <Animated.View entering={FadeIn}>
          {/* Statutory deductions — pension + NHF + RRA */}
          <Card variant="success" style={styles.resultCard}>
            <Text style={styles.resultLabel}>Deductions (Pension {(PENSION_RATE * 100).toFixed(0)}% + NHF {(NHF_RATE * 100).toFixed(0)}%{result.rra > 0 ? ' + RRA' : ''})</Text>
            <Text style={styles.resultBig}>
              −₦{Math.round(result.pension + result.nhf + result.rra).toLocaleString('en-NG')}
            </Text>
            <Text style={styles.resultNote}>
              {result.rra > 0
                ? `RRA: min(20% × rent, ₦${RENT_RELIEF_CAP.toLocaleString('en-NG')}) — NTA 2025 §30(2)`
                : 'Rent Relief Allowance (RRA) available if you pay rent — NTA 2025 §30(2)'}
            </Text>
          </Card>

          {/* Total PIT */}
          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>Tax Liability</Text>
            <Text style={[styles.resultBig, { color: colors.primary[600] }]}>
              ₦{Math.round(result.total).toLocaleString('en-NG')}
            </Text>
            <View style={styles.rateRow}>
              <Text style={styles.resultNote}>Effective rate: </Text>
              <Badge
                label={`${(result.effectiveRate * 100).toFixed(1)}%`}
                variant={result.effectiveRate < 0.15 ? 'success' : result.effectiveRate < 0.20 ? 'warning' : 'error'}
              />
            </View>
          </Card>

          {/* Band breakdown */}
          <Text style={styles.breakdownTitle}>Band Breakdown</Text>
          {result.bands.map((band, idx) => (
            <Animated.View key={band.label} entering={FadeIn.delay(idx * STAGGER.item)}>
              <Card style={styles.bandCard}>
                <View style={styles.bandRow}>
                  <View>
                    <Text style={styles.bandLabel}>{band.label}</Text>
                    <Text style={styles.bandRate}>{(band.rate * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bandIncome}>
                      ₦{Math.round(band.bandIncome).toLocaleString('en-NG')}
                    </Text>
                    <Text style={styles.bandTax}>
                      Tax: ₦{Math.round(band.taxOnBand).toLocaleString('en-NG')}
                    </Text>
                  </View>
                </View>
                <ProgressBar value={band.rate / 0.25} height={4} style={{ marginTop: 6 }} />
              </Card>
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── VAT Calculator ───────────────────────────────────────────────────────────

function VATCalc() {
  const { t } = useTranslation();
  const [amount, setAmount]       = useState<number>(0);
  const [inclusive, setInclusive] = useState(false);

  const vat = useMemo(() => {
    if (!amount) return null;
    if (inclusive) {
      const net = amount / 1.075;
      return { net: Math.round(net), vat: Math.round(amount - net), total: amount };
    }
    return { net: amount, vat: Math.round(amount * VAT_RATE), total: Math.round(amount * 1.075) };
  }, [amount, inclusive]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="vat"><Text>{t('tools.vatCalc')}</Text></TaxTooltip>
        {' '}— NTA 2025 §11 ({(VAT_RATE * 100).toFixed(1)}%)
      </Text>

      <NairaInput
        label={inclusive ? t('tools.vatInclusiveLabel', { defaultValue: 'VAT-Inclusive Amount (₦)' }) : t('tools.vatExclusiveLabel', { defaultValue: 'Amount Before VAT (₦)' })}
        value={amount || undefined}
        onChangeText={setAmount}
        required
      />

      <Pressable
        onPress={() => setInclusive(v => !v)}
        style={styles.toggleRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: inclusive }}
      >
        <View style={[styles.checkbox, inclusive && styles.checkboxOn]}>
          {inclusive && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.toggleLabel}>Amount already includes VAT</Text>
      </Pressable>

      {vat && (
        <Animated.View entering={FadeIn}>
          <Card variant="success" style={styles.resultCard}>
            <ResultLine label="Net Amount"  value={vat.net} />
            <ResultLine label="VAT (7.5%)" value={vat.vat} accent />
            <View style={styles.totalLine} />
            <ResultLine label="Total"      value={vat.total} bold />
          </Card>

          {amount >= 200_000 && (
            <Card variant="warning" style={{ marginTop: spacing[3] }}>
              <Text style={styles.nrsNote}>
                ⚠️ This amount (₦{vat.total.toLocaleString('en-NG')}) ≥ ₦200,000 — NRS e-invoice stamp required (NRS 2026 §3)
              </Text>
            </Card>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── CIT Calculator ───────────────────────────────────────────────────────────

function CITCalc() {
  const [profit, setProfit] = useState<number>(0);
  const result = useMemo(() => profit > 0 ? calcCIT(profit) : null, [profit]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="cit"><Text>CIT Calculator</Text></TaxTooltip>
        {' '}— NTA 2025 §55
      </Text>
      <NairaInput label="Annual Taxable Profit (₦)" value={profit || undefined} onChangeText={setProfit} required />

      {result && (
        <Animated.View entering={FadeIn}>
          <Card variant={result.tier === 'small' ? 'success' : 'default'} style={styles.resultCard}>
            <Text style={styles.resultLabel}>
              {result.tier === 'small' ? '✅ Small Company — Tax Exempt' : `${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} Company`}
            </Text>
            <Text style={[styles.resultBig, { color: colors.primary[600] }]}>
              ₦{Math.round(result.tax).toLocaleString('en-NG')} CIT
            </Text>
            <Text style={styles.resultNote}>Rate: {(result.rate * 100).toFixed(0)}% — Profit: ₦{profit.toLocaleString('en-NG')}</Text>
          </Card>

          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>Development Levy (4%) — NTA 2025 §60A</Text>
            <Text style={[styles.resultBig, { color: colors.accent[600] }]}>
              ₦{Math.round(result.devLevy).toLocaleString('en-NG')}
            </Text>
            <Text style={styles.resultNote}>Total tax burden: ₦{Math.round(result.tax + result.devLevy).toLocaleString('en-NG')}</Text>
          </Card>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── PAYE Calculator ──────────────────────────────────────────────────────────

function PAYECalc() {
  const [salary, setSalary] = useState<number>(0);
  const result = useMemo(() => salary > 0 ? calcPAYE(salary) : null, [salary]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="paye"><Text>PAYE Calculator</Text></TaxTooltip>
        {' '}— NTA 2025 §82
      </Text>
      <NairaInput label="Gross Monthly Salary (₦)" value={salary || undefined} onChangeText={setSalary} required />

      {result && (
        <Animated.View entering={FadeIn}>
          <Card style={styles.resultCard}>
            <ResultLine label="Gross Salary"          value={result.gross} />
            <ResultLine label="Pension (8%)"          value={-result.pension} accent />
            <ResultLine label="NHF (2.5%)"            value={-result.nhf} accent />
            <ResultLine label="PAYE Tax"              value={-result.paye} accent />
            <View style={styles.totalLine} />
            <ResultLine label="Net Pay"               value={result.net} bold />
          </Card>
          <Text style={styles.payeNote}>
            PAYE must be remitted to LIRS/SIRS by the 10th of each month (NTA 2025 §82)
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── WHT Calculator ───────────────────────────────────────────────────────────

function WHTCalc() {
  const [amount, setAmount] = useState<number>(0);
  const [whtType, setWhtType] = useState<keyof typeof WHT_RATES>('consultancy');

  const wht = useMemo(() => {
    if (!amount) return null;
    const rate = WHT_RATES[whtType];
    return { rate, whtAmount: Math.round(amount * rate), netPayment: Math.round(amount * (1 - rate)) };
  }, [amount, whtType]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="wht"><Text>WHT Calculator</Text></TaxTooltip>
        {' '}— NTA 2025 §78
      </Text>

      <Text style={styles.typeLabel}>Payment Type</Text>
      <View style={styles.typeGrid}>
        {(Object.entries(WHT_RATES) as [keyof typeof WHT_RATES, number][]).map(([key, rate]) => (
          <Pressable
            key={key}
            onPress={() => setWhtType(key)}
            style={[styles.typeChip, whtType === key && styles.typeChipSelected]}
          >
            <Text style={[styles.typeChipText, whtType === key && styles.typeChipTextSelected]}>
              {whtLabel(key)} ({(rate * 100).toFixed(0)}%)
            </Text>
          </Pressable>
        ))}
      </View>

      <NairaInput label="Gross Payment Amount (₦)" value={amount || undefined} onChangeText={setAmount} required />

      {wht && (
        <Animated.View entering={FadeIn}>
          <Card style={styles.resultCard}>
            <ResultLine label="Gross Payment"  value={amount} />
            <ResultLine label={`WHT (${(wht.rate * 100).toFixed(0)}%)`} value={-wht.whtAmount} accent />
            <View style={styles.totalLine} />
            <ResultLine label="Pay to Vendor"  value={wht.netPayment} bold />
          </Card>
          <Card variant="warning" style={{ marginTop: spacing[3] }}>
            <Text style={styles.payeNote}>
              Remit ₦{wht.whtAmount.toLocaleString('en-NG')} WHT to NRS by the 21st of next month
            </Text>
          </Card>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── CGT Calculator ───────────────────────────────────────────────────────────

function CGTCalc() {
  const [buyPrice, setBuyPrice]   = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [qty, setQty]             = useState<number>(1);

  const result = useMemo(() => {
    if (!buyPrice || !sellPrice) return null;
    const gain = (sellPrice - buyPrice) * qty;
    const cgt  = gain > 0 ? gain * CGT_RATE : 0;
    return { gain, cgt, acquisitionCost: buyPrice * qty, disposalProceeds: sellPrice * qty };
  }, [buyPrice, sellPrice, qty]);

  return (
    <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
      <Text style={styles.calcTitle}>
        <TaxTooltip tooltipKey="cgt"><Text>CGT Calculator</Text></TaxTooltip>
        {' '}— NTA 2025 Sch. 5 (10%)
      </Text>
      <NairaInput label="Acquisition Price per Unit (₦)" value={buyPrice || undefined} onChangeText={setBuyPrice} required />
      <NairaInput label="Disposal Price per Unit (₦)"   value={sellPrice || undefined} onChangeText={setSellPrice} required />
      <NairaInput label="Quantity / Units" value={qty || undefined} onChangeText={setQty} required />

      {result && (
        <Animated.View entering={FadeIn}>
          <Card variant={result.gain > 0 ? 'default' : 'success'} style={styles.resultCard}>
            <ResultLine label="Acquisition Cost"  value={result.acquisitionCost} />
            <ResultLine label="Disposal Proceeds" value={result.disposalProceeds} />
            <View style={styles.totalLine} />
            <ResultLine label="Gain / (Loss)"     value={result.gain} bold />
          </Card>

          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>Capital Gains Tax (10%)</Text>
            <Text style={[styles.resultBig, { color: result.cgt > 0 ? colors.error : colors.primary[600] }]}>
              ₦{Math.round(result.cgt).toLocaleString('en-NG')}
            </Text>
            {result.gain <= 0 && (
              <Text style={styles.resultNote}>✅ No CGT on losses</Text>
            )}
          </Card>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── Compliance Calendar ──────────────────────────────────────────────────────

const DEADLINES = [
  { type: 'PAYE Remittance',  day: 10, month: 'following',  ref: 'NTA 2025 §82',  urgent: true },
  { type: 'VAT Return',       day: 21, month: 'following',  ref: 'NTA 2025 §11',  urgent: false },
  { type: 'WHT Remittance',   day: 21, month: 'following',  ref: 'NTA 2025 §78',  urgent: false },
  { type: 'PIT Annual',       day: 31, month: 'March',      ref: 'NTA 2025 §41',  urgent: false },
  { type: 'CIT Annual',       day: 30, month: 'June',       ref: 'NTA 2025 §55',  urgent: false },
];

function ComplianceCalendar() {
  const now    = new Date();
  const month  = now.getMonth();
  const year   = now.getFullYear();

  const upcoming = DEADLINES.map(d => {
    let deadlineDate: Date;
    if (d.month === 'following') {
      deadlineDate = new Date(year, month + 1, d.day);
    } else if (d.month === 'March') {
      deadlineDate = new Date(year, 2, d.day);
    } else {
      deadlineDate = new Date(year, 5, d.day);
    }
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...d, deadlineDate, daysLeft };
  }).filter(d => d.daysLeft >= -7).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <View style={{ marginTop: spacing[6] }}>
      <Text style={styles.calendarTitle}>📅 Compliance Calendar</Text>
      {upcoming.map((d, idx) => (
        <Animated.View key={d.type} entering={FadeIn.delay(idx * STAGGER.item)}>
          <Card
            variant={d.daysLeft <= 0 ? 'error' : d.daysLeft <= 7 ? 'warning' : 'default'}
            style={styles.deadlineCard}
          >
            <View style={styles.deadlineRow}>
              <View style={styles.deadlineDot}>
                <Text style={styles.deadlineDotText}>{d.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deadlineName}>{d.type}</Text>
                <Text style={styles.deadlineRef}>{d.ref}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {d.daysLeft <= 0
                  ? <Badge label="OVERDUE" variant="error" size="sm" />
                  : d.daysLeft <= 7
                  ? <Badge label={`${d.daysLeft}d left`} variant="warning" size="sm" dot />
                  : <Badge label={`${d.daysLeft} days`} variant="neutral" size="sm" />
                }
              </View>
            </View>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ResultLine({ label, value, bold, accent }: {
  label: string; value: number; bold?: boolean; accent?: boolean;
}) {
  return (
    <View style={styles.resultLine}>
      <Text style={[styles.resultLineLabel, bold && styles.resultLineLabelBold]}>{label}</Text>
      <Text style={[
        styles.resultLineValue,
        bold   && styles.resultLineValueBold,
        accent && { color: value < 0 ? colors.error : colors.textPrimary },
      ]}>
        {value < 0 ? '−' : ''}₦{Math.abs(Math.round(value)).toLocaleString('en-NG')}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.gray[50] },
  header:       { paddingHorizontal: spacing.screenPadding, paddingVertical: spacing[3] },
  headerTitle: {
    fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  tabsScroll:   { flexGrow: 0 },
  tabsRow: {
    paddingHorizontal: spacing.screenPadding, paddingBottom: spacing[2], gap: spacing[2],
  },
  tab: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radii.full, backgroundColor: colors.gray[100],
    alignItems: 'center', gap: 3, minWidth: 56,
  },
  tabActive:      { backgroundColor: colors.primary[500] },
  tabEmoji:       { fontSize: 18 },
  tabLabel:       { fontSize: 12, fontWeight: typography.weights.semibold, color: colors.textMuted },
  tabLabelActive: { color: colors.textInverse },

  scroll:       { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[4] },
  calcTitle: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[4],
  },

  resultCard:   { marginBottom: spacing[3] },
  resultLabel:  { fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: 4, fontWeight: typography.weights.medium },
  resultBig:    { fontSize: typography.sizes['3xl'], fontWeight: typography.weights.extrabold, fontFamily: 'monospace' as any },
  resultNote:   { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 4 },
  rateRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 4 },

  resultLine:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  resultLineLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
  resultLineLabelBold: { color: colors.textPrimary, fontWeight: typography.weights.semibold },
  resultLineValue: { fontSize: typography.sizes.sm, color: colors.textPrimary },
  resultLineValueBold: { fontWeight: typography.weights.extrabold, fontSize: typography.sizes.base },
  totalLine:    { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },

  breakdownTitle: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
    color: colors.textSecondary, marginBottom: spacing[2], marginTop: spacing[2],
    textTransform: 'uppercase', letterSpacing: 1,
  },
  bandCard:     { marginBottom: spacing[2], padding: spacing[3] },
  bandRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bandLabel:    { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textPrimary },
  bandRate:     { fontSize: typography.sizes.xs, color: colors.primary[600], fontWeight: typography.weights.bold },
  bandIncome:   { fontSize: typography.sizes.sm, color: colors.textMuted, textAlign: 'right' },
  bandTax:      { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textPrimary, textAlign: 'right' },

  nrsNote:      { fontSize: typography.sizes.sm, color: colors.accent[700] },
  payeNote:     { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing[2], lineHeight: 18 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn:   { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark:    { color: colors.textInverse, fontSize: 12, fontWeight: typography.weights.bold },
  toggleLabel:  { fontSize: typography.sizes.sm, color: colors.textSecondary },

  typeLabel:    { fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: typography.weights.medium, marginBottom: spacing[2] },
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  typeChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  typeChipSelected:     { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  typeChipText:         { fontSize: typography.sizes.xs, color: colors.textMuted },
  typeChipTextSelected: { color: colors.primary[700], fontWeight: typography.weights.semibold },

  calendarTitle: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[3],
  },
  deadlineCard:  { marginBottom: spacing[2] },
  deadlineRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  deadlineDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: 'center', justifyContent: 'center',
  },
  deadlineDotText: { fontSize: 14, fontWeight: typography.weights.bold, color: colors.primary[700] },
  deadlineName: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textPrimary },
  deadlineRef:  { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
});
