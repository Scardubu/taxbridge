import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_META: Array<{ name: string; icon: IoniconName; key: string }> = [
  { name: 'index',        icon: 'home',             key: 'dashboard' },
  { name: 'invoices',     icon: 'document-text',    key: 'invoices' },
  { name: 'tax-calendar', icon: 'calendar',         key: 'calendar' },
  { name: 'compliance',   icon: 'shield-checkmark', key: 'compliance' },
  { name: 'settings',     icon: 'settings',         key: 'settings' },
];

function buildScreenOptions({ route }: { route: { name: string } }): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: '#006B3F',
    tabBarInactiveTintColor: '#8A9BB0',
    tabBarIcon: ({ color, size }: { color: string; size: number }) => {
      const meta = TAB_META.find((m) => m.name === route.name);
      return <Ionicons name={meta?.icon ?? 'ellipse'} size={size} color={color} />;
    },
  };
}

export default function TabsLayout() {
  const isDone = useIsOnboardingDone();
  const { t } = useTranslation();

  if (!isDone) return <Redirect href="/(onboarding)/" />;

  return (
    <Tabs screenOptions={buildScreenOptions}>
      {TAB_META.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(`tabs.${tab.key}`) }} />
      ))}
    </Tabs>
  );
}
