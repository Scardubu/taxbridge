import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

// SDK-08: NativeTabs crashes on iOS 18 dev builds — guard with platform check.
// Use NativeTabs on production iOS and all Android; fall back to Tabs elsewhere.
const USE_NATIVE_TABS =
  Platform.OS === 'android' ||
  (Platform.OS === 'ios' && !__DEV__);

type TabEntry = {
  name: string;
  sfSymbol: string;       // iOS SF Symbol name
  drawable: string;       // Android vector drawable name
  labelKey: string;
};

// Exactly 5 NativeTabs entries — constraint #12
const TABS: TabEntry[] = [
  { name: 'index',        sfSymbol: 'house.fill',          drawable: 'ic_home',        labelKey: 'dashboard'   },
  { name: 'invoices',     sfSymbol: 'doc.text.fill',       drawable: 'ic_document',    labelKey: 'invoices'    },
  { name: 'tax-calendar', sfSymbol: 'calendar',            drawable: 'ic_calendar',    labelKey: 'calendar'    },
  { name: 'compliance',   sfSymbol: 'shield.fill',         drawable: 'ic_shield',      labelKey: 'compliance'  },
  { name: 'settings',     sfSymbol: 'gearshape.fill',      drawable: 'ic_settings',    labelKey: 'settings'    },
];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const FALLBACK_ICONS: Record<string, IoniconName> = {
  index:          'home',
  invoices:       'document-text',
  'tax-calendar': 'calendar',
  compliance:     'shield-checkmark',
  settings:       'settings',
};

export default function TabsLayout() {
  const isDone = useIsOnboardingDone();
  const { t } = useTranslation();

  if (!isDone) return <Redirect href="/(onboarding)/" />;

  if (USE_NATIVE_TABS) {
    return (
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          title: t(`tabs.${TABS.find(t => t.name === route.name)?.labelKey ?? ''}`),
          tabBarActiveTintColor: '#006B3F',
          tabBarInactiveTintColor: '#8A9BB0',
          tabBarIcon: ({ color, size }) => {
            const iconName = FALLBACK_ICONS[route.name] ?? 'ellipse';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          // Enable native tabs on supported platforms
          native: {
            enable: true,
          },
        })}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: t(`tabs.${tab.labelKey}`) }}
          />
        ))}
      </Tabs>
    );
  }

  // Fallback: standard Expo Router Tabs (iOS 18 dev client + web)
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#006B3F',
        tabBarInactiveTintColor: '#8A9BB0',
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Ionicons
            name={FALLBACK_ICONS[route.name] ?? 'ellipse'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: t(`tabs.${tab.labelKey}`) }}
        />
      ))}
    </Tabs>
  );
}
