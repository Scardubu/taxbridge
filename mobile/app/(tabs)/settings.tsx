import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import i18n from '../../i18n';
import { AppKV } from '../../storage/kv';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';

export default function SettingsTab() {
  const tokens = useTokens();
  const [language, setLanguage] = useState<'en' | 'pidgin'>(AppKV.prefs.getLanguage());
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
      label: 'Pidgin voice guidance',
      value: voiceEnabled,
      onChange: (value: boolean) => {
        setVoiceEnabled(value);
        AppKV.prefs.setVoice(value);
      },
    },
    {
      key: 'dark',
      label: 'Dark mode preference',
      value: darkMode,
      onChange: (value: boolean) => {
        setDarkMode(value);
        AppKV.prefs.setDarkMode(value);
      },
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>Settings</Text>
        <Pressable onPress={() => void toggleLanguage()} style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
          <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>Language</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary }}>{language === 'en' ? 'English' : 'Pidgin'}</Text>
        </Pressable>
        {settingRows.map((row) => (
          <View key={row.key} style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{row.label}</Text>
            <Switch value={row.value} onValueChange={row.onChange} thumbColor={palette.white} trackColor={{ true: palette.nrsGreen, false: palette.gray200 }} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
