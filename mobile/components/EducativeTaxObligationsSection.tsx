import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { TAX_AUTHORITY, computeObligations } from '../services/nrsCompliance';
import { Colors, Typography, Spacing, Radii } from './design-system/tokens';

type ObligationKey = 'vatRegistration' | 'vatFiling' | 'eInvoicing' | 'cit';

interface Props {
  obligations: ReturnType<typeof computeObligations>;
  isPreviewMode: boolean;
}

export function EducativeTaxObligationsSection({ obligations, isPreviewMode }: Readonly<Props>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<ObligationKey | null>(null);

  const rows = useMemo(
    () => [
      {
        key: 'vatRegistration' as const,
        title: t('obligations.vatReg'),
        threshold: t('obligations.vatRegThreshold'),
        action: t('obligations.vatRegAction'),
        status: obligations.vatRegistrationRequired ? t('obligations.required') : t('obligations.notRequired'),
      },
      {
        key: 'vatFiling' as const,
        title: t('obligations.vatFiling'),
        threshold: t('obligations.vatFilingThreshold'),
        action: t('obligations.vatFilingAction'),
        status: obligations.vatFilingRequired ? t('obligations.requiredMonthly') : t('obligations.notRequired'),
      },
      {
        key: 'eInvoicing' as const,
        title: t('obligations.eInvoice'),
        threshold: t('obligations.eInvoiceThreshold'),
        action: t('obligations.eInvoiceAction'),
        status: t(`einvoice.status.${obligations.eInvoicingPhase}`),
      },
      {
        key: 'cit' as const,
        title: t('obligations.cit'),
        threshold: t('obligations.citThreshold'),
        action: t('obligations.citAction'),
        status: obligations.citRate === 0 ? t('obligations.citZero') : t('obligations.status.citRate', { rate: obligations.citRate * 100 }),
      },
    ],
    [obligations.citRate, obligations.eInvoicingPhase, obligations.vatFilingRequired, obligations.vatRegistrationRequired, t]
  );

  return (
    <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
        <Text style={{ ...Typography.section, color: Colors.ui.textMuted }}>
          {t('dashboard.taxObligations')}
        </Text>
        {isPreviewMode ? (
          <View style={{ backgroundColor: Colors.ui.surface, borderRadius: Radii.pill, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs }}>
            <Text style={{ ...Typography.micro, color: Colors.ui.textDim }}>{t('dashboard.previewData')}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ backgroundColor: Colors.ui.surface, borderRadius: Radii.xl, overflow: 'hidden' }}>
        {rows.map((row, index) => {
          const isOpen = expanded === row.key;
          const rowA11yLabel = `${row.title}: ${row.status}`;

          return (
            <View key={row.key}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: Colors.ui.border, marginHorizontal: Spacing.lg }} /> : null}
              <Pressable
                onPress={() => setExpanded(isOpen ? null : row.key)}
                accessibilityRole="button"
                accessibilityLabel={rowA11yLabel}
                accessibilityHint={t('obligations.tapToLearn')}
                accessibilityState={{ expanded: isOpen }}
                style={{ padding: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ ...Typography.micro, color: Colors.ui.textMuted, letterSpacing: 0.5 }}>
                      {row.title}
                    </Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-forward'} size={16} color={Colors.ui.textDim} />
                  </View>
                  <Text style={{ ...Typography.body, color: Colors.ui.text, fontWeight: '600', marginTop: 4 }}>
                    {row.status}
                  </Text>

                  {isOpen ? (
                    <View style={{ marginTop: Spacing.sm }}>
                      <Text style={{ ...Typography.caption, color: Colors.ui.textMuted, lineHeight: 19 }}>
                        {row.threshold}
                      </Text>
                      <Text style={{ ...Typography.caption, color: Colors.ui.textDim, lineHeight: 19, marginTop: 6 }}>
                        {row.action}
                      </Text>
                      {row.key === 'vatRegistration' || row.key === 'vatFiling' || row.key === 'eInvoicing' ? (
                        <View style={{ marginTop: Spacing.sm }}>
                          <Text style={{ ...Typography.caption, color: Colors.ui.textMuted }}>
                            {t('obligations.portalLabel', { portal: TAX_AUTHORITY.portalUrl })}
                          </Text>
                          <Pressable
                            onPress={() => void Linking.openURL(TAX_AUTHORITY.portalUrl)}
                            accessibilityRole="link"
                            accessibilityLabel={t('accessibility.openFirsPortal')}
                            style={{ marginTop: Spacing.xs }}
                          >
                            <Text style={{ ...Typography.micro, color: Colors.brand.accent }}>
                              {t('obligations.tapToLearn')} →
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
