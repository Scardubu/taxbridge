import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18n, { normalizeLanguage, type SupportedLanguage } from '../../i18n';
import { AppKV } from '../../storage/kv';
import { palette, radius, shadows, spacing, typography, useTokens } from '../../components/design-system/tokens';
import Constants from 'expo-constants';

export default function SettingsTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const [language, setLanguage] = useState<SupportedLanguage>(normalizeLanguage(i18n.resolvedLanguage));
  const [voiceEnabled, setVoiceEnabled] = useState(AppKV.prefs.isVoiceEnabled());
  const [darkMode, setDarkMode] = useState(AppKV.prefs.isDarkMode());

  const toggleLanguage = async () => {
    const next = language === 'en' ? 'pidgin' : 'en';
    setLanguage(next);
    AppKV.prefs.setLanguage(next);
    await i18n.changeLanguage(next);
  };

  const settingRows = [
    {
      key: 'voice',
      label: t('common.voiceGuidance'),
      icon: 'volume-high' as const,
      value: voiceEnabled,
      onChange: (value: boolean) => {
        setVoiceEnabled(value);
        AppKV.prefs.setVoice(value);
      },
    },
    {
      key: 'dark',
      label: t('common.darkMode'),
      icon: 'moon' as const,
      value: darkMode,
      onChange: (value: boolean) => {
        setDarkMode(value);
        AppKV.prefs.setDarkMode(value);
      },
    },
  ];

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('settings.title')}</Text>

        <Pressable
          onPress={() => void toggleLanguage()}
          accessibilityRole="button"
          accessibilityLabel={t('common.language')}
          accessibilityHint={language === 'en' ? t('common.pidgin') : t('common.english')}
          style={({ pressed }) => ({
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            opacity: pressed ? 0.85 : 1,
            ...shadows.sm,
          })}
        >
          <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.nrsGreenLight, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="language" size={22} color={palette.nrsGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('common.language')}</Text>
            <Text style={{ ...typography.caption, color: tokens.textSecondary }}>
              {language === 'en' ? t('common.english') : t('common.pidgin')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.textMuted} />
        </Pressable>

        {settingRows.map((row) => (
          <View
            key={row.key}
            style={{
              backgroundColor: tokens.bgCard,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: tokens.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              ...shadows.sm,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.nrsGreenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={row.icon} size={22} color={palette.nrsGreen} />
            </View>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, flex: 1 }}>{row.label}</Text>
            <Switch
              value={row.value}
              onValueChange={row.onChange}
              thumbColor={palette.white}
              trackColor={{ true: palette.nrsGreen, false: palette.gray200 }}
              accessibilityRole="switch"
              accessibilityLabel={row.label}
              accessibilityState={{ checked: row.value }}
            />
          </View>
        ))}

        <View style={{ alignItems: 'center', paddingTop: spacing.lg, gap: spacing.xs }}>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>TaxBridge v{appVersion}</Text>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>{t('settings.madeInNigeria')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
