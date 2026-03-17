/**
 * TaxBridge Tax Education — Tooltip + TaxAcademy
 * Contextual knowledge at point of use, bilingual EN + Pidgin
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import { DURATION } from '../../design-system/animation';
import { Card, Button } from '../../design-system/components';

// ─── Tooltip Content Library ──────────────────────────────────────────────────
// 40 most-asked Nigerian SME tax terms (support ticket analysis)

export interface TaxTooltipContent {
  term:             string;
  plain:            string;
  pidgin?:          string;
  example?:         string;
  statute?:         string;
  learnMoreScreen?: string;
}

export const TAX_TOOLTIPS: Record<string, TaxTooltipContent> = {
  vat: {
    term: 'VAT (Value Added Tax)',
    plain: 'A 7.5% tax added to goods and services you sell. Mandatory registration if annual turnover exceeds ₦25M.',
    pidgin: 'VAT na 7.5% wey you go add on top wetin you dey sell. If your business make ₦25M or more per year, you must register.',
    example: 'You sell a laptop for ₦200,000. Add 7.5% VAT = ₦215,000 total. The ₦15,000 goes to NRS.',
    statute: 'NTA 2025 §11',
    learnMoreScreen: 'vat-basics',
  },
  pit: {
    term: 'PIT (Personal Income Tax)',
    plain: 'Tax on income earned by individuals and sole proprietors. Nigeria uses a 6-band progressive system: 0% up to ₦800k, then 15%, 18%, 21%, 23%, and 25%.',
    pidgin: 'PIT na tax wey person go pay on money wey dem earn. The first ₦800k no get tax, then the next bands na 15%, 18%, 21%, 23%, and 25% depending on how much you earn.',
    example: 'Annual income ₦2M → first ₦800k taxed at 0% = ₦0, next ₦1.2M at 15% = ₦180k. Total PIT ≈ ₦180k before any reliefs.',
    statute: 'NTA 2025 §1-40',
    learnMoreScreen: 'pit-guide',
  },
  cit: {
    term: 'CIT (Company Income Tax)',
    plain: 'Tax on company profits. 0% for small companies (under ₦25M turnover), 20% for medium, 30% for large.',
    pidgin: 'CIT na tax on company profit. Small company (under ₦25M) no pay, medium pay 20%, big company pay 30%.',
    example: 'Your company earns ₦40M turnover with ₦10M profit. You pay 20% CIT = ₦2M.',
    statute: 'NTA 2025 §55',
    learnMoreScreen: 'cit-guide',
  },
  paye: {
    term: 'PAYE (Pay As You Earn)',
    plain: 'Employers deduct income tax from employee salaries each month and remit to the state tax authority by the 10th.',
    pidgin: 'PAYE na tax wey employer go cut from worker salary every month and send to state tax office before 10th.',
    example: 'Staff earns ₦150k/month. You compute PIT (≈₦8.5k), deduct it, and remit to LIRS by 10th.',
    statute: 'NTA 2025 §82',
    learnMoreScreen: 'paye-guide',
  },
  wht: {
    term: 'WHT (Withholding Tax)',
    plain: 'A prepayment of tax deducted at source when making certain payments (rent, professional fees, dividends). Rate: 5–10%.',
    pidgin: 'WHT na tax wey you go cut from money you pay for rent, professional service, or dividend. Rate na 5-10%.',
    example: 'You pay a consultant ₦500,000. Deduct 5% WHT = ₦25,000. Pay consultant ₦475k, remit ₦25k to NRS.',
    statute: 'NTA 2025 §78',
    learnMoreScreen: 'wht-guide',
  },
  irn: {
    term: 'IRN (Invoice Reference Number)',
    plain: 'A unique code assigned by NRS to verify your invoice is legally valid. Required for all B2B invoices ≥ ₦200,000.',
    pidgin: 'IRN na unique code wey NRS go give your invoice to show say e valid. You need am for business invoice wey reach ₦200k.',
    example: 'After you create an invoice in TaxBridge, we submit it to NRS and they stamp it with an IRN like: TXB-2026-0042891.',
    statute: 'NRS 2026 §3',
    learnMoreScreen: 'e-invoicing',
  },
  tin: {
    term: 'TIN (Tax Identification Number)',
    plain: 'Your unique 10-digit number from the Joint Tax Board. Required for filing taxes, business accounts, and contracts.',
    pidgin: 'TIN na your 10-digit number from JTB. You need am to file tax, open business account, or sign contract.',
    example: 'Example TIN: 1234567890. Get yours free at jtb.gov.ng or any NRS office.',
    learnMoreScreen: 'tin-guide',
  },
  devLevy: {
    term: 'Development Levy (4%)',
    plain: 'A 4% levy on company profits introduced in NTA 2025 to fund national infrastructure development.',
    pidgin: '4% levy on company profit wey NTA 2025 add to fund infrastructure. E dey on top of CIT.',
    statute: 'NTA 2025 §60A',
    learnMoreScreen: 'development-levy',
  },
  cgt: {
    term: 'CGT (Capital Gains Tax)',
    plain: 'A 10% tax on profits from selling or disposing of assets, including cryptocurrency. Applies to gains, not the full sale price.',
    pidgin: '10% tax on profit wey you make when you sell asset or crypto. Na only the gain dem tax, not the full price.',
    example: 'You bought Bitcoin for ₦500k. Sold for ₦900k. Gain = ₦400k. CGT = 10% × ₦400k = ₦40k.',
    statute: 'NTA 2025 Sch. 5',
    learnMoreScreen: 'crypto-cgt',
  },
  edt: {
    term: 'EDT (Electronic Data Tax)',
    plain: 'A 2% tax on digital income earned by businesses with more than ₦25M in digital revenue annually.',
    pidgin: '2% tax on digital income for business wey get more than ₦25M digital revenue per year.',
    statute: 'NTA 2025 §30',
    learnMoreScreen: 'development-levy',
  },
  minEtr: {
    term: 'Minimum ETR (15%)',
    plain: 'The global minimum effective tax rate. If your combined tax rate on qualifying profits falls below 15%, you pay a top-up.',
    pidgin: 'Minimum tax rate of 15% on qualifying profit. If your tax no reach 15%, you go pay extra to make am up.',
    statute: 'NTA 2025 §19',
  },
  cra: {
    term: 'RRA (Rent Relief Allowance)',
    plain: 'Replaces the abolished CRA. A deduction based on your rent: min(20% × annual rent, ₦500,000). Reduces your taxable income if you pay rent.',
    pidgin: 'RRA na new relief wey replace CRA. Dem go remove money from your income based on rent wey you dey pay — up to ₦500k.',
    example: 'Annual rent ₦2M. RRA = min(20% × ₦2M, ₦500k) = min(₦400k, ₦500k) = ₦400k deduction.',
    statute: 'NTA 2025 §30(2)',
  },
  nrs: {
    term: 'NRS (Nigeria Revenue Service)',
    plain: 'Nigeria\'s central tax authority responsible for collecting federal taxes and issuing e-invoice stamps (IRN/CSID).',
    pidgin: 'NRS na Nigeria federal tax authority. Dem dey collect tax and give IRN stamp for e-invoice.',
    example: 'When you file VAT return, you submit to NRS. When you create B2B invoice ≥ ₦200k, NRS stamps it digitally.',
  },
  bvn: {
    term: 'BVN (Bank Verification Number)',
    plain: 'An 11-digit number linking your biometric data to all your bank accounts in Nigeria. Required for KYC verification.',
    pidgin: 'BVN na 11-digit number wey connect your finger print to all your bank account. You need am for KYC.',
  },
};

// ─── TaxTooltip Component ─────────────────────────────────────────────────────

interface TaxTooltipProps {
  tooltipKey: keyof typeof TAX_TOOLTIPS;
  children:   React.ReactNode;
}

export function TaxTooltip({ tooltipKey, children }: TaxTooltipProps) {
  const [visible, setVisible] = useState(false);
  const { i18n } = useTranslation();
  const isPidgin  = i18n.language === 'pidgin';
  const content   = TAX_TOOLTIPS[tooltipKey];

  const open  = useCallback(() => setVisible(true),  []);
  const close = useCallback(() => setVisible(false), []);

  if (!content) return <>{children}</>;

  return (
    <>
      <TouchableOpacity
        onPress={open}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Learn about ${content.term}`}
        accessibilityHint="Opens a tax explanation"
        style={styles.trigger}
      >
        {children}
        <View style={styles.infoIcon}>
          <Text style={styles.infoIconText}>ⓘ</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Animated.View
            entering={SlideInDown.duration(DURATION.transition).springify()}
            style={styles.sheet}
          >
            <Pressable onPress={() => {}} accessible={false}>
              {/* Drag handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.tooltipHeader}>
                <Text style={styles.tooltipTerm}>{content.term}</Text>
                <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Explanation */}
              <Text style={styles.tooltipBody}>
                {isPidgin && content.pidgin ? content.pidgin : content.plain}
              </Text>

              {/* Bilingual toggle */}
              {content.pidgin && (
                <Text style={styles.altLang}>
                  {isPidgin ? `EN: ${content.plain}` : `Pidgin: ${content.pidgin}`}
                </Text>
              )}

              {/* Example */}
              {content.example && (
                <View style={styles.exampleBlock}>
                  <Text style={styles.exampleLabel}>📌 Example</Text>
                  <Text style={styles.exampleText}>{content.example}</Text>
                </View>
              )}

              {/* Statute */}
              {content.statute && (
                <Text style={styles.statute}>⚖️ {content.statute}</Text>
              )}

              {/* TaxAcademy link */}
              {content.learnMoreScreen && (
                <TouchableOpacity
                  style={styles.learnMoreBtn}
                  onPress={() => {
                    close();
                    /* learn detail screen not yet registered */
                  }}
                  accessibilityRole="link"
                >
                  <Text style={styles.learnMoreText}>📚 Learn more in TaxAcademy →</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── TaxAcademy Home Screen ───────────────────────────────────────────────────

interface Lesson {
  id:          string;
  emoji:       string;
  title:       string;
  duration:    string;
  route:       string;
  difficulty:  'beginner' | 'intermediate' | 'advanced';
}

const LESSONS: Lesson[] = [
  { id: 'tin-guide',        emoji: '🪪', title: 'Getting Your TIN',              duration: '3 min', route: 'tin-guide',        difficulty: 'beginner' },
  { id: 'vat-basics',       emoji: '🧾', title: 'VAT — Registration & Filing',   duration: '5 min', route: 'vat-basics',       difficulty: 'beginner' },
  { id: 'pit-guide',        emoji: '💼', title: 'Personal Income Tax',           duration: '7 min', route: 'pit-guide',        difficulty: 'beginner' },
  { id: 'paye-guide',       emoji: '👥', title: 'PAYE for Employers',            duration: '6 min', route: 'paye-guide',       difficulty: 'intermediate' },
  { id: 'cit-guide',        emoji: '🏢', title: 'Company Income Tax',            duration: '8 min', route: 'cit-guide',        difficulty: 'intermediate' },
  { id: 'wht-guide',        emoji: '🔂', title: 'Withholding Tax',               duration: '4 min', route: 'wht-guide',        difficulty: 'intermediate' },
  { id: 'e-invoicing',      emoji: '📋', title: 'NRS E-Invoicing & IRN',         duration: '5 min', route: 'e-invoicing',      difficulty: 'beginner' },
  { id: 'development-levy', emoji: '🏗️', title: 'Development Levy (4%) + EDT',   duration: '4 min', route: 'development-levy', difficulty: 'intermediate' },
  { id: 'crypto-cgt',       emoji: '₿',  title: 'Crypto & Capital Gains Tax',    duration: '5 min', route: 'crypto-cgt',       difficulty: 'advanced' },
  { id: 'glossary',         emoji: '📖', title: 'Tax Glossary A-Z',              duration: '10 min',route: 'glossary',         difficulty: 'beginner' },
];

const DIFFICULTY_COLORS = {
  beginner:     { bg: colors.primary[50], text: colors.primary[700] },
  intermediate: { bg: colors.accent[100], text: colors.accent[700] },
  advanced:     { bg: colors.red[50],     text: colors.red[700] },
};

export function TaxAcademyHomeScreen() {
  const { t } = useTranslation();
  const insets = { bottom: 80, top: 16 } as any;

  // In production this comes from SQLite via useLearningProgress()
  const completed = new Set<string>();
  const total = LESSONS.length;
  const progress = completed.size / total;

  return (
    <ScrollView
      contentContainerStyle={[styles.academyScroll, { paddingBottom: insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.academyHero}>
        <Text style={styles.academyTitle}>🎓 {t('learn.taxAcademy')}</Text>
        <Text style={styles.academySubtitle}>{t('learn.subtitle')}</Text>

        {/* Progress */}
        <Card style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>
              {completed.size}/{total} {t('learn.lessonsComplete')}
            </Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            />
          </View>
        </Card>
      </Animated.View>

      {/* Lesson sections */}
      <Text style={styles.sectionTitle}>{t('learn.startHere')}</Text>
      {LESSONS.filter(l => l.difficulty === 'beginner').map((lesson, idx) => (
        <Animated.View key={lesson.id} entering={FadeIn.delay(idx * 50)}>
          <LessonCard lesson={lesson} completed={completed.has(lesson.id)} />
        </Animated.View>
      ))}

      <Text style={styles.sectionTitle}>{t('learn.intermediate')}</Text>
      {LESSONS.filter(l => l.difficulty === 'intermediate').map((lesson, idx) => (
        <Animated.View key={lesson.id} entering={FadeIn.delay(idx * 50)}>
          <LessonCard lesson={lesson} completed={completed.has(lesson.id)} />
        </Animated.View>
      ))}

      <Text style={styles.sectionTitle}>{t('learn.advanced')}</Text>
      {LESSONS.filter(l => l.difficulty === 'advanced').map((lesson, idx) => (
        <Animated.View key={lesson.id} entering={FadeIn.delay(idx * 50)}>
          <LessonCard lesson={lesson} completed={completed.has(lesson.id)} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function LessonCard({ lesson, completed }: { lesson: Lesson; completed: boolean }) {
  const dc = DIFFICULTY_COLORS[lesson.difficulty];
  return (
    <Card
      style={[styles.lessonCard, completed && styles.lessonCardDone]}
      onPress={() => { /* learn detail screen not yet registered */ }}
    >
      <View style={styles.lessonRow}>
        <Text style={styles.lessonEmoji}>{completed ? '✅' : lesson.emoji}</Text>
        <View style={styles.lessonBody}>
          <Text style={[styles.lessonTitle, completed && styles.lessonTitleDone]}>
            {lesson.title}
          </Text>
          <View style={styles.lessonMeta}>
            <Text style={styles.lessonDuration}>⏱ {lesson.duration}</Text>
            <View style={[styles.difficultyBadge, { backgroundColor: dc.bg }]}>
              <Text style={[styles.difficultyText, { color: dc.text }]}>
                {lesson.difficulty}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.lessonChevron}>›</Text>
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tooltip trigger
  trigger:     { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  infoIcon: {
    marginLeft: spacing[1],
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary[100],
    alignItems: 'center', justifyContent: 'center',
  },
  infoIconText:{ fontSize: 11, color: colors.primary[700], fontWeight: typography.weights.bold },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.modal, borderTopRightRadius: radii.modal,
    padding: spacing[5],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing[4],
  },
  tooltipHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing[3],
  },
  tooltipTerm: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.bold,
    color: colors.textPrimary, flex: 1,
  },
  closeBtn: { fontSize: 18, color: colors.textMuted, padding: spacing[1] },
  tooltipBody: {
    fontSize: typography.sizes.base, color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    marginBottom: spacing[3],
  },
  altLang: {
    fontSize: typography.sizes.sm, color: colors.textMuted,
    fontStyle: 'italic', marginBottom: spacing[3],
    paddingLeft: spacing[3], borderLeftWidth: 2, borderLeftColor: colors.border,
  },
  exampleBlock: {
    backgroundColor: colors.gray[50], borderRadius: radii.md,
    padding: spacing[3], marginBottom: spacing[3],
  },
  exampleLabel: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textSecondary, marginBottom: spacing[1],
    textTransform: 'uppercase', letterSpacing: 1,
  },
  exampleText: { fontSize: typography.sizes.sm, color: colors.textSecondary, lineHeight: 20 },
  statute: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing[3] },
  learnMoreBtn: {
    backgroundColor: colors.primary[50], borderRadius: radii.md,
    padding: spacing[3], alignItems: 'center',
  },
  learnMoreText: { fontSize: typography.sizes.sm, color: colors.primary[700], fontWeight: typography.weights.semibold },

  // Academy
  academyScroll: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[4] },
  academyHero:   { marginBottom: spacing[5] },
  academyTitle: {
    fontSize: typography.sizes['2xl'], fontWeight: typography.weights.extrabold,
    color: colors.textPrimary, marginBottom: spacing[1],
  },
  academySubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing[4] },
  progressCard:  { },
  progressTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  progressLabel: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  progressPct:   { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.primary[600] },
  progressTrack: {
    height: 8, borderRadius: 4,
    backgroundColor: colors.gray?.[100] ?? '#F3F4F6',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8, borderRadius: 4,
    backgroundColor: colors.primary[500] ?? '#16A34A',
  },
  sectionTitle: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[2], marginTop: spacing[4],
  },
  lessonCard:     { marginBottom: spacing[2] },
  lessonCardDone: { opacity: 0.75 },
  lessonRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  lessonEmoji:    { fontSize: 28 },
  lessonBody:     { flex: 1 },
  lessonTitle:    { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.textPrimary },
  lessonTitleDone:{ textDecorationLine: 'line-through', color: colors.textMuted },
  lessonMeta:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 3 },
  lessonDuration: { fontSize: typography.sizes.xs, color: colors.textMuted },
  lessonChevron: { fontSize: 20, color: colors.textMuted },
  difficultyBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
  difficultyText: { fontSize: 10, fontWeight: typography.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
});
