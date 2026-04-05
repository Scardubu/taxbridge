import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TAX_AUTHORITY, computeObligations } from '../services/nrsCompliance';

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
        status: obligations.vatRegistrationRequired ? t('compliance.required') : t('compliance.notRequired'),
      },
      {
        key: 'vatFiling' as const,
        status: obligations.vatFilingRequired ? t('compliance.monthlyRequired') : t('compliance.notRequired'),
      },
      {
        key: 'eInvoicing' as const,
        status: t(`einvoice.status.${obligations.eInvoicingPhase}`),
      },
      {
        key: 'cit' as const,
        status: obligations.citRate === 0 ? t('tax.cit.exempt') : t('obligations.status.citRate', { rate: obligations.citRate * 100 }),
      },
    ],
    [obligations.citRate, obligations.eInvoicingPhase, obligations.vatFilingRequired, obligations.vatRegistrationRequired, t]
  );

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 16, fontWeight: '600' }}>
          {t('dashboard.obligations.title')}
        </Text>
        {isPreviewMode ? (
          <View style={{ backgroundColor: '#1C1C1C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#6B7280', fontSize: 11 }}>{t('preview.data')}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ backgroundColor: '#1C1C1C', borderRadius: 20, overflow: 'hidden' }}>
        {rows.map((row, index) => {
          const isOpen = expanded === row.key;

          return (
            <View key={row.key}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: '#2A2A2A', marginHorizontal: 16 }} /> : null}
              <Pressable
                onPress={() => setExpanded(isOpen ? null : row.key)}
                accessibilityRole="button"
                accessibilityLabel={`${t(`obligations.${row.key}.title`)}: ${row.status}`}
                accessibilityState={{ expanded: isOpen }}
                style={{ padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF', fontSize: 12, letterSpacing: 0.5 }}>
                      {t(`obligations.${row.key}.title`)}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 16 }}>{isOpen ? '↑' : '›'}</Text>
                  </View>
                  <Text style={{ color: '#F9FAFB', fontWeight: '600', fontSize: 15, marginTop: 4 }}>
                    {row.status}
                  </Text>

                  {isOpen ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 19 }}>
                        {t(`obligations.${row.key}.threshold`)}
                      </Text>
                      <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                        {t(`obligations.${row.key}.action`)}
                      </Text>
                      {row.key === 'vatRegistration' || row.key === 'vatFiling' || row.key === 'eInvoicing' ? (
                        <Text style={{ color: '#34D399', fontSize: 12, marginTop: 8 }}>
                          {t('obligations.portalLabel', { portal: TAX_AUTHORITY.portalUrl })}
                        </Text>
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
