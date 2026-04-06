import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Colors, Typography, Spacing, Radii } from './design-system/tokens';

interface Props {
  onContinue: () => void;
}

export function OnboardingProgressBanner({ onContinue }: Readonly<Props>) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <View
      style={{
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.lg,
        backgroundColor: Colors.status.successBg,
        borderColor: Colors.status.successBorder,
        borderWidth: 1,
        borderRadius: Radii.lg,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
      }}
    >
      <Text style={{ fontSize: 20 }}>\uD83D\uDE80</Text>
      <Text
        style={{
          flex: 1,
          ...Typography.caption,
          color: Colors.status.successText,
          lineHeight: 18,
        }}
      >
        {t('dashboard.bannerBody')}
      </Text>
      <Pressable
        onPress={() => { void Haptics.selectionAsync(); onContinue(); }}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.bannerCta')}
        style={{
          backgroundColor: Colors.brand.primary,
          borderRadius: Radii.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
        }}
      >
        <Text style={{ color: Colors.ui.white, ...Typography.micro, fontWeight: '700' }}>
          {t('dashboard.bannerCta')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setDismissed(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
        style={{ padding: 4 }}
      >
        <Text style={{ color: Colors.brand.badge, fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}
