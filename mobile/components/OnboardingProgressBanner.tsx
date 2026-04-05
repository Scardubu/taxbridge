import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

interface Props {
  onContinue: () => void;
}

export function OnboardingProgressBanner({ onContinue }: Readonly<Props>) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const bannerStyle = {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: '#064E3B',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 1,
    transform: [{ translateY: 0 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: '220ms',
  } as any;

  if (dismissed) {
    return null;
  }

  return (
    <View style={bannerStyle}>
      <Text style={{ fontSize: 22 }}>🚀</Text>
      <Text style={{ flex: 1, color: '#D1FAE5', fontSize: 13, lineHeight: 18 }}>
        {t('preview.banner')}
      </Text>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onContinue();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('preview.cta')}
        style={{
          backgroundColor: '#10B981',
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
          {t('preview.cta')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
        style={{ padding: 4 }}
      >
        <Text style={{ color: '#6EE7B7', fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}
