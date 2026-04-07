import React, { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Localization from 'expo-localization';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { AppKV } from '../../storage/kv';
import { OnboardingErrorBoundary } from '../../components/OnboardingErrorBoundary';
import { OnboardingProgressBar } from '../../components/OnboardingProgressBar';
import { Colors, Typography, Spacing, Radii } from '../../components/design-system/tokens';
import { useOnboardingStore } from '../../stores/onboardingStore';

const FEATURES = [
  {
    icon: '📋',
    titleKey: 'onboarding.feature1Title',
    bodyKey: 'onboarding.feature1Body',
  },
  {
    icon: '📡',
    titleKey: 'onboarding.feature2Title',
    bodyKey: 'onboarding.feature2Body',
  },
  {
    icon: '📅',
    titleKey: 'onboarding.feature3Title',
    bodyKey: 'onboarding.feature3Body',
  },
] as const;

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const setPreviewMode = useOnboardingStore((state) => state.setPreviewMode);

  useEffect(() => {
    useOnboardingStore.setState({ currentStepId: 'welcome' });
  }, []);

  useEffect(() => {
    const isNigerianLocale = Localization.getLocales().some((locale) => {
      const tag = locale.languageTag ?? '';
      return locale.regionCode === 'NG' || tag.startsWith('en-NG') || tag.startsWith('pcm');
    });

    if (isNigerianLocale && i18n.language === 'en') {
      AppKV.prefs.setLanguage('pidgin');
      void i18n.changeLanguage('pidgin');
    }
  }, [i18n]);

  const handleExploreFirst = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewMode(true);
    router.replace('/(tabs)');
  }, [setPreviewMode]);

  const handleGetStarted = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreviewMode(false);
    router.push('/(onboarding)/business-type');
  }, [setPreviewMode]);

  const handleLanguageToggle = useCallback((lang: 'en' | 'pidgin') => {
    void Haptics.selectionAsync();
    AppKV.prefs.setLanguage(lang);
    void i18n.changeLanguage(lang);
  }, [i18n]);

  return (
    <OnboardingErrorBoundary stepId="welcome">
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Colors.ui.bg }}>
        <OnboardingProgressBar percent={0} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.xxl,
            paddingTop: Spacing.section,
            paddingBottom: Spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg }}>
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: Colors.brand.primary,
                borderRadius: Radii.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>🇳🇬</Text>
            </View>
            <Text
              style={{
                color: Colors.brand.primary,
                ...Typography.label,
                letterSpacing: 1.5,
              }}
            >
              {t('onboarding.gettingStarted')}
            </Text>
          </View>

          <Text style={{ ...Typography.headline, color: Colors.ui.text, marginBottom: Spacing.md }}>
            {t('onboarding.headline')}
          </Text>
          <Text style={{ ...Typography.body, color: Colors.ui.textMuted, marginBottom: Spacing.section }}>
            {t('onboarding.subheadline')}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: Colors.ui.surface,
              borderRadius: Radii.pill,
              padding: 4,
              marginBottom: Spacing.section,
            }}
          >
            {(['en', 'pidgin'] as const).map((lang) => {
              const active = i18n.language === lang;

              return (
                <Pressable
                  key={lang}
                  onPress={() => handleLanguageToggle(lang)}
                  accessibilityRole="tab"
                  accessibilityLabel={lang === 'en' ? t('accessibility.switchEnglish') : t('accessibility.switchPidgin')}
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: Radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: Spacing.sm,
                    backgroundColor: active ? Colors.brand.primary : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{lang === 'en' ? '🇬🇧' : '🇳🇬'}</Text>
                  <Text
                    style={{
                      ...Typography.body,
                      fontWeight: '600',
                      color: active ? Colors.ui.white : Colors.ui.textMuted,
                    }}
                  >
                    {lang === 'en' ? t('common.english') : t('common.pidgin')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              backgroundColor: Colors.brand.primaryDim,
              borderColor: Colors.brand.border,
              borderWidth: 1,
              borderRadius: Radii.xl,
              padding: Spacing.xl,
              marginBottom: Spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
              <Text style={{ ...Typography.section, color: Colors.brand.accent, flex: 1 }}>
                {t('onboarding.nrsTitle')}
              </Text>
              <View
                style={{
                  backgroundColor: Colors.brand.badgeBg,
                  borderRadius: Radii.pill,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: Colors.brand.badge, ...Typography.micro }}>{t('onboarding.welcome.featureBadge')}</Text>
              </View>
            </View>
            <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: Spacing.sm }}>
              {t('onboarding.nrsBody')}
            </Text>
          </View>

          {FEATURES.map((feature) => (
            <View
              key={feature.titleKey}
              style={{
                flexDirection: 'row',
                gap: Spacing.lg,
                marginBottom: Spacing.xl,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: Colors.ui.surface,
                  borderRadius: Radii.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>{feature.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...Typography.body,
                    fontWeight: '600',
                    color: Colors.ui.text,
                    marginBottom: Spacing.xs,
                  }}
                >
                  {t(feature.titleKey)}
                </Text>
                <Text style={{ ...Typography.caption, color: Colors.ui.textDim }}>
                  {t(feature.bodyKey)}
                </Text>
              </View>
            </View>
          ))}

          <Text
            style={{
              ...Typography.micro,
              color: Colors.ui.textDim,
              textAlign: 'center',
              marginBottom: Spacing.xl,
            }}
          >
            {t('onboarding.timeEstimate')}
          </Text>
        </ScrollView>

        <View style={{ paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.lg }}>
          <Pressable
            onPress={handleGetStarted}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.getStarted')}
            accessibilityHint={t('accessibility.guidedSetupHint')}
            style={{
              backgroundColor: Colors.brand.primary,
              borderRadius: Radii.lg,
              paddingVertical: 18,
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <Text style={{ color: Colors.ui.white, fontSize: 17, fontWeight: '700' }}>
              {t('onboarding.getStarted')} →
            </Text>
          </Pressable>

          <Pressable
            onPress={handleExploreFirst}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.exploreDash')}
            accessibilityHint={t('accessibility.previewDashboardHint')}
            style={{ paddingVertical: Spacing.md, alignItems: 'center' }}
          >
            <Text style={{ ...Typography.body, color: Colors.ui.textDim }}>
              {t('onboarding.exploreDash')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </OnboardingErrorBoundary>
  );
}
