import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { AppKV } from '../../storage/kv';
import i18n, { normalizeLanguage, type SupportedLanguage } from '../../i18n';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const [lang, setLang] = useState<SupportedLanguage>(normalizeLanguage(i18n.resolvedLanguage));

  // UX-05 fix: Detect Nigerian locale on first load, suggest Pidgin
  useEffect(() => {
    const stored = normalizeLanguage(i18n.resolvedLanguage);
    if (stored === 'en') {
      const locales = Localization.getLocales();
      const isNigerian = locales.some(
        (l) =>
          l.regionCode === 'NG' ||
          l.languageTag?.startsWith('yo') ||
          l.languageTag?.startsWith('ha') ||
          l.languageTag?.startsWith('ig')
      );
      if (isNigerian) {
        setLang('pidgin');
        AppKV.prefs.setLanguage('pidgin');
        void i18n.changeLanguage('pidgin');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLang = async (newLang: SupportedLanguage) => {
    setLang(newLang);
    AppKV.prefs.setLanguage(newLang);
    await i18n.changeLanguage(newLang);
  };

  return (
    <OnboardingFrame
      stepId="welcome"
      title={t('onboarding.welcome.headline')}
      body={t('onboarding.welcome.subheadline')}
      primaryLabel={t('onboarding.welcome.cta')}
      onPrimary={() => void advanceToNext('welcome')}
    >
      {/* UX-05 fix: Prominent language toggle — not buried in settings */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: tokens.bgCard,
          borderRadius: radius.xl,
          padding: spacing.xs,
          gap: spacing.xs,
        }}
      >
        {(['en', 'pidgin'] as const).map((l) => (
          <Pressable
            key={l}
            onPress={() => void toggleLang(l)}
            accessibilityRole="button"
            accessibilityLabel={l === 'en' ? t('common.english') : t('common.pidgin')}
            accessibilityState={{ selected: lang === l }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: lang === l ? palette.nrsGreen : 'transparent',
            }}
          >
            <Text
              style={{
                ...typography.bodyBold,
                color: lang === l ? palette.white : tokens.textSecondary,
              }}
            >
              {l === 'en' ? t('common.english') : t('common.pidgin')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={{
          backgroundColor: palette.gray50,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <Text style={{ ...typography.h3, color: palette.gray900 }}>
          {t('onboarding.welcome.featureTitle')}
        </Text>
        <Text style={{ ...typography.body, color: palette.gray600 }}>
          {t('onboarding.welcome.featureBody')}
        </Text>
      </View>
    </OnboardingFrame>
  );
}
