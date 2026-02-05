import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { VATGuide } from '../components/tax/VATGuide';
import { WHTGuide } from '../components/tax/WHTGuide';
import { PITGuide } from '../components/tax/PITGuide';
import { TINGuide } from '../components/tax/TINGuide';
import { NRSGuide } from '../components/tax/NRSGuide';

const TAB_IDS = ['vat', 'wht', 'pit', 'tin', 'nrs'] as const;

type TabId = (typeof TAB_IDS)[number];

export default function TaxGuideScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabId>('vat');

  const tabs = useMemo(() => (
    [
      { id: 'vat' as const, label: t('tax.guide.tabs.vat') },
      { id: 'wht' as const, label: t('tax.guide.tabs.wht') },
      { id: 'pit' as const, label: t('tax.guide.tabs.pit') },
      { id: 'tin' as const, label: t('tax.guide.tabs.tin') },
      { id: 'nrs' as const, label: t('tax.guide.tabs.nrs') },
    ]
  ), [t]);

  const renderContent = () => {
    switch (activeTab) {
      case 'vat':
        return <VATGuide />;
      case 'wht':
        return <WHTGuide />;
      case 'pit':
        return <PITGuide />;
      case 'tin':
        return <TINGuide />;
      case 'nrs':
        return <NRSGuide />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('tax.guide.title')}</Text>
          <Text style={styles.subtitle}>{t('tax.guide.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
