import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

const USE_NATIVE_TABS = Platform.OS !== 'ios' || !__DEV__;

const TAB_META = [
  { name: 'index', sf: 'house.fill', drawable: 'ic_home', key: 'dashboard' },
  { name: 'invoices', sf: 'doc.text.fill', drawable: 'ic_description', key: 'invoices' },
  { name: 'tax-calendar', sf: 'calendar.badge.clock', drawable: 'ic_calendar_today', key: 'calendar' },
  { name: 'compliance', sf: 'checkmark.shield.fill', drawable: 'ic_verified_user', key: 'compliance' },
  { name: 'settings', sf: 'gearshape.fill', drawable: 'ic_settings', key: 'settings' },
] as const;

export default function TabsLayout() {
  const isDone = useIsOnboardingDone();
  const { t } = useTranslation();

  if (!isDone) return <Redirect href="/(onboarding)/" />;

  if (!USE_NATIVE_TABS) {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#006B3F' }}>
        {TAB_META.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(`tabs.${tab.key}`) }} />
        ))}
      </Tabs>
    );
  }

  return (
    <NativeTabs>
      {TAB_META.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <Icon sf={tab.sf} drawable={tab.drawable} />
          <Label>{t(`tabs.${tab.key}`)}</Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
