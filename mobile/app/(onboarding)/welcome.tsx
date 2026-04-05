import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Localization from 'expo-localization';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { OnboardingErrorBoundary } from '../../components/OnboardingErrorBoundary';
import { OnboardingProgressBar } from '../../components/OnboardingProgressBar';
import { AppKV } from '../../storage/kv';
import i18n, { normalizeLanguage, type SupportedLanguage } from '../../i18n';
import { DEFAULT_TAB_ROUTE, useOnboardingStore } from '../../stores/onboardingStore';

const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: SupportedLanguage;
  flag: string;
  labelKey: string;
  accessibilityKey: string;
}> = [
  {
    code: 'en',
    flag: '🇬🇧',
    labelKey: 'common.english',
    accessibilityKey: 'onboarding.welcome.switchEnglish',
  },
  {
    code: 'pidgin',
    flag: '🇳🇬',
    labelKey: 'common.pidgin',
    accessibilityKey: 'onboarding.welcome.switchPidgin',
  },
];

const HIGHLIGHTS: ReadonlyArray<{
  key: 'setup' | 'offline' | 'deadlines';
  icon: string;
}> = [
  { key: 'setup', icon: '📋' },
  { key: 'offline', icon: '📡' },
  { key: 'deadlines', icon: '📅' },
];

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const setPreviewMode = useOnboardingStore((state) => state.setPreviewMode);
  const language = normalizeLanguage(i18n.resolvedLanguage);

  useEffect(() => {
    useOnboardingStore.setState({ currentStepId: 'welcome' });
  }, []);

  useEffect(() => {
    if (language !== 'en') {
      return;
    }

    const isNigerianLocale = Localization.getLocales().some((locale) => {
      const tag = locale.languageTag ?? '';
      return locale.regionCode === 'NG' || tag.startsWith('en-NG') || tag.startsWith('pcm');
    });

    if (isNigerianLocale) {
      AppKV.prefs.setLanguage('pidgin');
      void i18n.changeLanguage('pidgin');
    }
  }, [language]);

  const handleGetStarted = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreviewMode(false);
    router.push('/(onboarding)/business-type');
  };

  const handleExploreFirst = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewMode(true);
    router.replace(DEFAULT_TAB_ROUTE);
  };

  const handleLanguageToggle = (nextLanguage: SupportedLanguage) => {
    void Haptics.selectionAsync();
    AppKV.prefs.setLanguage(nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <OnboardingErrorBoundary stepId="welcome">
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
            <OnboardingProgressBar percent={0} />
          </View>

          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: '#1D9E75',
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>🇳🇬</Text>
              </View>
              <Text style={{ color: '#1D9E75', fontWeight: '600', fontSize: 13, letterSpacing: 1.5 }}>
                {t('onboarding.eyebrow.welcome')}
              </Text>
            </View>

            <Text style={{ fontSize: 42, fontWeight: '800', color: '#FFFFFF', lineHeight: 46, marginBottom: 12 }}>
              {t('onboarding.welcome.headline')}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 36 }}>
              {t('onboarding.welcome.subheadline')}
            </Text>

            <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1C', borderRadius: 24, padding: 4, marginBottom: 36 }}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = language === option.code;
                const languageOptionStyle = {
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  backgroundColor: selected ? '#1D9E75' : 'transparent',
                  transitionProperty: 'background-color',
                  transitionDuration: '200ms',
                } as any;

                return (
                  <Pressable
                    key={option.code}
                    onPress={() => handleLanguageToggle(option.code)}
                    accessibilityRole="button"
                    accessibilityLabel={t(option.accessibilityKey)}
                    accessibilityState={{ selected }}
                    style={languageOptionStyle}
                  >
                    <Text style={{ fontSize: 18 }}>{option.flag}</Text>
                    <Text
                      style={{
                        fontWeight: '600',
                        fontSize: 15,
                        color: selected ? '#FFFFFF' : '#9CA3AF',
                      }}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                backgroundColor: 'rgba(16,74,56,0.35)',
                borderColor: '#0F6E56',
                borderWidth: 1,
                borderRadius: 20,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🛡️</Text>
                <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 17, flex: 1 }}>
                  {t('onboarding.welcome.featureTitle')}
                </Text>
                <View style={{ backgroundColor: '#064E3B', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#6EE7B7', fontSize: 11, fontWeight: '600' }}>
                    {t('onboarding.welcome.featureBadge')}
                  </Text>
                </View>
              </View>
              <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 14, lineHeight: 20 }}>
                {t('onboarding.welcome.featureBody')}
              </Text>
            </View>

            {HIGHLIGHTS.map((item) => (
              <View
                key={item.key}
                style={{ flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: '#1C1C1C',
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F9FAFB', fontWeight: '600', fontSize: 15, marginBottom: 4 }}>
                    {t(`onboarding.welcome.highlights.${item.key}.title`)}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 19 }}>
                    {t(`onboarding.welcome.highlights.${item.key}.body`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
            <Text style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
              {t('onboarding.welcome.timeEstimate')}
            </Text>

            <Pressable
              onPress={handleGetStarted}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.welcome.ctaHint')}
              style={{
                backgroundColor: '#1D9E75',
                borderRadius: 16,
                paddingVertical: 18,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>
                {t('onboarding.getStarted')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleExploreFirst}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.welcome.skipCta')}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280', fontSize: 15 }}>
                {t('onboarding.exploreDash')}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </OnboardingErrorBoundary>
  );
}
