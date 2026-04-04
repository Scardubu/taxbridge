import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';
import { OnboardingFrame, advanceToNext, skipSetupForNow } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { AppKV } from '../../storage/kv';
import i18n, { normalizeLanguage, type SupportedLanguage } from '../../i18n';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const [lang, setLang] = useState<SupportedLanguage>(normalizeLanguage(i18n.resolvedLanguage));
  const highlights = [
    { key: 'setup', icon: '📋', color: palette.nrsGreenLight },
    { key: 'offline', icon: '📡', color: palette.blue50 },
    { key: 'deadlines', icon: '📅', color: palette.amber50 },
  ] as const;

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
      secondaryLabel={t('onboarding.welcome.skipCta')}
      onSecondary={() => void skipSetupForNow()}
    >
      {/* UX-05: Prominent language toggle — not buried in settings */}
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
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.lg,
              backgroundColor: lang === l ? palette.nrsGreen : 'transparent',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.xs,
            }}
          >
            <Text style={{ fontSize: 16 }}>{l === 'en' ? '🇬🇧' : '🇳🇬'}</Text>
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

      {/* What you'll set up */}
      <View
        style={{
          backgroundColor: palette.nrsGreenLight,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: `${palette.nrsGreen}20`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 18 }}>🛡️</Text>
          <Text style={{ ...typography.h3, color: palette.nrsGreenDim }}>
            {t('onboarding.welcome.featureTitle')}
          </Text>
        </View>
        <Text style={{ ...typography.body, color: palette.gray600, lineHeight: 22 }}>
          {t('onboarding.welcome.featureBody')}
        </Text>
      </View>

      {/* Feature highlights */}
      <View style={{ gap: spacing.sm }}>
        {highlights.map(({ key, icon, color }) => (
          <View
            key={key}
            style={{
              backgroundColor: tokens.bgCard,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: tokens.border,
              flexDirection: 'row',
              gap: spacing.md,
              alignItems: 'flex-start',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.lg,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>{icon}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
                {t(`onboarding.welcome.highlights.${key}.title`)}
              </Text>
              <Text style={{ ...typography.body, color: tokens.textSecondary, lineHeight: 21 }}>
                {t(`onboarding.welcome.highlights.${key}.body`)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Time estimate */}
      <View style={{ alignItems: 'center', paddingTop: spacing.xs }}>
        <Text style={{ ...typography.caption, color: tokens.textMuted }}>
          {t('onboarding.welcome.timeEstimate')}
        </Text>
      </View>
    </OnboardingFrame>
  );
}
