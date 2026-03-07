/**
 * ExplainMyTax — Offline-safe bundled tax concept explainer (§11A.4)
 *
 * 7 keys: vat, wht, paye, nil_return, tin, cit, penalty
 * Content is bundled (zero API calls) — works on 2G and fully offline.
 * Each concept has EN + Pidgin (natural Lagos Pidgin, not literal translation).
 *
 * Usage:
 *   <ExplainMyTax concept="wht" />
 *
 * Constraints:
 *   C-06  All strings bilingual (en + pidgin)
 *   C-07  Never throws — renders nothing on unknown key
 *   C-16  Animation via DURATION.* tokens
 *   C-20  scale(0.97) ack on toggle Pressable
 *   CF-04 useTheme() for colors — dark-mode safe
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../design-system/tokens';

// ─── Bundled content ──────────────────────────────────────────────────────────

export type TaxConcept = 'vat' | 'wht' | 'paye' | 'nil_return' | 'tin' | 'cit' | 'penalty';

interface ConceptEntry {
  title:   { en: string; pidgin: string };
  body:    { en: string; pidgin: string };
  example: { en: string; pidgin: string };
  icon:    string;
}

const CONCEPTS: Record<TaxConcept, ConceptEntry> = {
  vat: {
    icon: '🧾',
    title: {
      en:     'Value Added Tax (VAT)',
      pidgin: 'VAT — Goment Tax',
    },
    body: {
      en:     'VAT is 7.5% charged on goods and services. As a registered business, you collect it from customers and remit it to the government monthly.',
      pidgin: 'VAT na 7.5% wey you go collect from customer for goods wey you sell. Every month, you go pay am give goment. No be your money — you dey hold am for goment.',
    },
    example: {
      en:     'You invoice ₦100,000 → Charge ₦107,500 (7.5% VAT) → Remit ₦7,500 to FIRS.',
      pidgin: 'If you invoice ₦100,000 → Charge customer ₦107,500 → Pay ₦7,500 go goment.',
    },
  },

  wht: {
    icon: '🏛️',
    title: {
      en:     'Withholding Tax (WHT)',
      pidgin: 'WHT — Back-Cut Tax',
    },
    body: {
      en:     'When you pay a contractor or supplier, you deduct WHT at the applicable rate (5–10%) and remit it directly to the government on their behalf.',
      pidgin: 'When you pay contractor, cut small from the money (5–10%) before you give them. That cut, send am go goment. No pocket am!',
    },
    example: {
      en:     'You owe supplier ₦200,000 → Deduct 10% WHT (₦20,000) → Pay supplier ₦180,000 → Remit ₦20,000 to government.',
      pidgin: 'You wan pay supplier ₦200,000 → Cut ₦20,000 (10%) → Give am ₦180,000 → Send ₦20,000 go goment.',
    },
  },

  paye: {
    icon: '👥',
    title: {
      en:     'Pay-As-You-Earn (PAYE)',
      pidgin: 'PAYE — Worker Tax',
    },
    body: {
      en:     'PAYE is income tax deducted from employee salaries each month. Employers compute, deduct, and remit it to the state tax authority by the 10th of the following month.',
      pidgin: 'PAYE na the income tax wey you go cut from worker salary every month. You go remit am give state goment before 10th of next month. No delay!',
    },
    example: {
      en:     'Employee earns ₦5,000,000/year → Tax = ₦632,400 → Deduct ₦52,700/month.',
      pidgin: 'Worker dey earn ₦5,000,000 per year → Tax na ₦632,400 → Cut ₦52,700 every month.',
    },
  },

  nil_return: {
    icon: '📋',
    title: {
      en:     'NIL Return',
      pidgin: 'NIL Return — Zero Filing',
    },
    body: {
      en:     'Even if your business had zero taxable transactions in a period, you must still file a NIL (zero) return. Failure to file attracts penalties.',
      pidgin: 'Even if you no sell anything for one period, you still need file NIL return. Goment must know say nothing happen — no file, na penalty.',
    },
    example: {
      en:     'Business closed for January? Still file VAT NIL return before the deadline to avoid ₦50,000+ penalty.',
      pidgin: 'You no trade for January? Still file NIL VAT before deadline. If you no file, dem go fine you ₦50,000 or more.',
    },
  },

  tin: {
    icon: '🪪',
    title: {
      en:     'Tax Identification Number (TIN)',
      pidgin: 'TIN — Your Tax ID',
    },
    body: {
      en:     'Your 8-digit TIN is your unique identifier with the tax authority. It\'s required for all filings, bank transactions above ₦1M, and government contracts.',
      pidgin: 'TIN na your 8-digit number wey goment give you. You need am for all tax filing, for bank transaction wey pass ₦1M, and for goment contract.',
    },
    example: {
      en:     'TIN format: 12345678. Register at the Joint Tax Board portal or any tax office.',
      pidgin: 'TIN dey look like: 12345678. Go register for JTB portal or nearest tax office.',
    },
  },

  cit: {
    icon: '🏢',
    title: {
      en:     'Corporate Income Tax (CIT)',
      pidgin: 'CIT — Company Tax',
    },
    body: {
      en:     'CIT is tax on company profits. Small companies (turnover < ₦25M) pay 0%. Medium companies (₦25M–₦100M) pay 20%. Large companies pay 30%. Due 6 months after financial year-end.',
      pidgin: 'CIT na tax on company profit. Small company (turnover < ₦25M) no pay. Medium (₦25M–₦100M) pay 20%. Big company pay 30%. You go file am 6 months after year end.',
    },
    example: {
      en:     'Company profit ₦50M, turnover ₦80M (medium) → CIT = ₦50M × 20% = ₦10M.',
      pidgin: 'Company profit ₦50M, turnover ₦80M (medium size) → CIT = ₦50M × 20% = ₦10M.',
    },
  },

  penalty: {
    icon: '⚠️',
    title: {
      en:     'Tax Penalties',
      pidgin: 'Penalty — Late Fine',
    },
    body: {
      en:     'Late filing penalties start at ₦50,000 for companies and ₦25,000 for individuals. Additional penalties of 2% per month apply on unpaid tax.',
      pidgin: 'If you file late, company go pay ₦50,000 fine. Individual pay ₦25,000. On top of that, 2% every month go add on top the tax wey you no pay.',
    },
    example: {
      en:     'VAT of ₦100,000 unpaid for 3 months → ₦50,000 (late filing) + ₦6,000 (2% × 3 months) = ₦56,000 total penalty.',
      pidgin: 'VAT ₦100,000 wey you no pay for 3 months → ₦50,000 (late filing) + ₦6,000 (2% × 3 months) = ₦56,000 total fine.',
    },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ExplainMyTaxProps {
  concept: TaxConcept;
  /** Allow collapsing the card. Defaults to expanded. */
  collapsible?: boolean;
}

export function ExplainMyTax({ concept, collapsible = true }: ExplainMyTaxProps) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();

  const [expanded, setExpanded] = useState(true);
  const [lang, setLang]         = useState<'en' | 'pidgin'>('en');

  const entry = CONCEPTS[concept];
  if (!entry) return null;  // C-07: never throw on unknown concept

  const isPidgin = lang === 'pidgin';
  const title    = isPidgin ? entry.title.pidgin  : entry.title.en;
  const body     = isPidgin ? entry.body.pidgin   : entry.body.en;
  const example  = isPidgin ? entry.example.pidgin : entry.example.en;

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* ── Header ── */}
      <Pressable
        onPress={() => collapsible && setExpanded((v) => !v)}
        style={({ pressed }) => [s.header, pressed && collapsible && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} — ${expanded ? 'collapse' : 'expand'}`}
      >
        <Text style={s.icon}>{entry.icon}</Text>
        <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {collapsible && (
          <Text style={[s.chevron, { color: colors.textSecondary }]}>
            {expanded ? '▲' : '▼'}
          </Text>
        )}
      </Pressable>

      {/* ── Lang toggle ── */}
      <View style={s.langRow}>
        <Pressable
          onPress={() => setLang('en')}
          style={({ pressed }) => [s.langBtn, lang === 'en' && s.langBtnActive, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="English"
          accessibilityState={{ selected: lang === 'en' }}
        >
          <Text style={[s.langText, lang === 'en' && s.langTextActive]}>EN</Text>
        </Pressable>
        <Pressable
          onPress={() => setLang('pidgin')}
          style={({ pressed }) => [s.langBtn, lang === 'pidgin' && s.langBtnActive, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Pidgin"
          accessibilityState={{ selected: lang === 'pidgin' }}
        >
          <Text style={[s.langText, lang === 'pidgin' && s.langTextActive]}>Pidgin</Text>
        </Pressable>
      </View>

      {/* ── Body ── */}
      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(150)} style={s.body}>
          <Text style={[s.bodyText, { color: colors.textPrimary }]}>{body}</Text>
          <View style={[s.exampleBox, { backgroundColor: colors.surfaceSubtle ?? '#F3F4F6', borderColor: colors.border }]}>
            <Text style={[s.exampleLabel, { color: colors.textSecondary }]}>📌 Example</Text>
            <Text style={[s.exampleText, { color: colors.textPrimary }]}>{example}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: SPACING[12],
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        SPACING[16],
    gap:            SPACING[8],
  },
  icon:    { fontSize: TYPOGRAPHY.xl },
  title:   { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600' },
  chevron: { fontSize: TYPOGRAPHY.xs },

  langRow: {
    flexDirection:    'row',
    paddingHorizontal: SPACING[16],
    paddingBottom:    SPACING[8],
    gap:              SPACING[8],
  },
  langBtn: {
    paddingVertical:   SPACING[4],
    paddingHorizontal: SPACING[12],
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       '#D1D5DB',
  },
  langBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  langText:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#6B7280' },
  langTextActive: { color: '#fff' },

  body: {
    paddingHorizontal: SPACING[16],
    paddingBottom:     SPACING[16],
    gap:               SPACING[12],
  },
  bodyText: { fontSize: TYPOGRAPHY.sm, lineHeight: 22 },
  exampleBox: {
    padding:      SPACING[12],
    borderRadius: RADIUS.md,
    borderWidth:  1,
    gap:          SPACING[4],
  },
  exampleLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText:  { fontSize: TYPOGRAPHY.xs, lineHeight: 18 },
});

export default ExplainMyTax;
