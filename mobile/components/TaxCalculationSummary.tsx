import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Radii, Spacing, Typography } from './design-system/tokens';
import type { TaxCalculationResult } from '../types/taxEngine';

interface Props {
  calculation: TaxCalculationResult | null;
  isPreviewMode: boolean;
}

function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function TaxCalculationSummary({ calculation, isPreviewMode }: Readonly<Props>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!calculation) {
    return null;
  }

  return (
    <View
      style={{
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.section,
        backgroundColor: Colors.ui.surface,
        borderColor: Colors.ui.border,
        borderWidth: 1,
        borderRadius: Radii.xl,
        overflow: 'hidden',
      }}
    >
      <Pressable onPress={() => setExpanded((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ padding: Spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Text style={{ fontSize: 18 }}>🧮</Text>
            <Text style={{ ...Typography.section, color: Colors.ui.textMuted }}>{t('taxCalc.title')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {isPreviewMode ? (
              <View style={{ backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.pill, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs }}>
                <Text style={{ ...Typography.micro, color: Colors.ui.textDim }}>{t('preview.data')}</Text>
              </View>
            ) : null}
            <Text style={{ color: Colors.ui.textDim, fontSize: 18 }}>{expanded ? '↑' : '↓'}</Text>
          </View>
        </View>

        {calculation.nextFilingDate ? (
          <View
            style={{
              marginTop: Spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              backgroundColor: Colors.status.warningBg,
              borderColor: Colors.status.warningBorder,
              borderWidth: 1,
              borderRadius: Radii.pill,
              alignSelf: 'flex-start',
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.xs,
            }}
          >
            <Text style={{ fontSize: 12 }}>📅</Text>
            <Text style={{ ...Typography.micro, color: Colors.status.warningText }}>
              {t('taxCalc.filingReminder', { date: calculation.nextFilingDate })}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={{ borderTopColor: Colors.ui.border, borderTopWidth: 1, padding: Spacing.xl, gap: Spacing.md }}>
          {calculation.vatRequired ? (
            <View style={{ backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.lg, padding: Spacing.lg }}>
              <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginBottom: Spacing.sm }}>{t('taxCalc.vatOwed')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>{t('taxCalc.outputVat')}</Text>
                <Text style={{ ...Typography.monoSm, color: Colors.ui.text }}>{formatNgn(calculation.vatOutputNgn)}</Text>
              </View>
              {calculation.vatInputCreditsNgn > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs }}>
                  <Text style={{ ...Typography.caption, color: Colors.receipt.vatCredit }}>{t('taxCalc.inputCredits')}</Text>
                  <Text style={{ ...Typography.monoSm, color: Colors.receipt.vatCredit }}>-{formatNgn(calculation.vatInputCreditsNgn)}</Text>
                </View>
              ) : null}
              <View style={{ height: 1, backgroundColor: Colors.ui.border, marginVertical: Spacing.sm }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...Typography.caption, fontWeight: '600', color: Colors.ui.text }}>{t('taxCalc.vatNetPayable')}</Text>
                <Text style={{ ...Typography.mono, fontWeight: '700', color: calculation.vatNetPayableNgn === 0 ? Colors.brand.accent : Colors.ui.text }}>
                  {formatNgn(calculation.vatNetPayableNgn)}
                </Text>
              </View>
              {calculation.vatNilReturn ? (
                <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginTop: Spacing.xs }}>{t('taxCalc.nilReturn')}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={{ backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>{t('taxCalc.citLiability')}</Text>
            <Text style={{ ...Typography.mono, color: calculation.citExempt ? Colors.brand.accent : Colors.ui.text }}>
              {calculation.citExempt ? t('taxCalc.zeroRate') : `${(calculation.citRate * 100).toFixed(0)}%`}
            </Text>
          </View>

          {calculation.whtTotalNgn > 0 ? (
            <View style={{ backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>{t('taxCalc.whtWithheld')}</Text>
              <Text style={{ ...Typography.mono, color: Colors.ui.text }}>{formatNgn(calculation.whtTotalNgn)}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>{t('taxCalc.eInvoicePhase')}</Text>
              <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginTop: 2 }}>
                {t('taxCalc.enforcementDate', { date: calculation.eInvoiceEnforcementDate })}
              </Text>
            </View>
            <View style={{ backgroundColor: Colors.brand.badgeBg, borderRadius: Radii.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}>
              <Text style={{ ...Typography.micro, color: Colors.brand.badge, textTransform: 'capitalize' }}>{calculation.eInvoicePhase}</Text>
            </View>
          </View>

          {isPreviewMode ? (
            <Text style={{ ...Typography.micro, color: Colors.ui.textDim, textAlign: 'center' }}>{t('taxCalc.previewNote')}</Text>
          ) : (
            <Pressable
              onPress={() => void Linking.openURL('https://einvoice.firs.gov.ng')}
              accessibilityRole="link"
              accessibilityLabel={t('taxCalc.confirmCalc')}
              style={{ alignItems: 'center', paddingTop: Spacing.sm }}
            >
              <Text style={{ ...Typography.caption, color: Colors.brand.accent }}>{t('taxCalc.confirmCalc')} →</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
