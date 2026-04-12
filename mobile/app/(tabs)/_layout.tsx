import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../components/design-system/tokens';
import { useIsOnboardingDone, usePreviewMode, useStoreHydrated } from '../../stores/onboardingStore';

// SDK-08: NativeTabs crashes on iOS 18 dev builds — guard with platform check.
// Use NativeTabs on production iOS and all Android; fall back to Tabs elsewhere.
const USE_NATIVE_TABS =
  Platform.OS === 'android' ||
  (Platform.OS === 'ios' && !__DEV__);

// Derive the exact sf prop type from the Icon component to satisfy SFSymbols7_0
type SFProp = NonNullable<React.ComponentProps<typeof Icon>['sf']>;

type TabEntry = {
  name: string;
  sfSymbol: SFProp;
  drawable: string;
  labelKey: string;
};

// Helper: cast a { default, selected } pair to the SFProp union type.
// Values are validated SF symbol names — the cast is safe.
const makeSF = (d: string, s: string): SFProp =>
  ({ default: d, selected: s }) as unknown as SFProp;

// Exactly 5 NativeTabs entries — constraint #12
const TABS: TabEntry[] = [
  { name: 'index',        sfSymbol: makeSF('house',     'house.fill'),     drawable: 'ic_home',     labelKey: 'dashboard' },
  { name: 'receipts',     sfSymbol: makeSF('camera',    'camera.fill'),    drawable: 'ic_camera',   labelKey: 'receipts'  },
  { name: 'tax-calendar', sfSymbol: makeSF('calendar',  'calendar'),       drawable: 'ic_calendar', labelKey: 'calendar'  },
  { name: 'compliance',   sfSymbol: makeSF('shield',    'shield.fill'),    drawable: 'ic_shield',   labelKey: 'compliance'},
  { name: 'settings',     sfSymbol: makeSF('gearshape', 'gearshape.fill'), drawable: 'ic_settings', labelKey: 'settings'  },
];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const FALLBACK_ICONS: Record<string, IoniconName> = {
  index:          'home',
  receipts:       'camera',
  'tax-calendar': 'calendar',
  compliance:     'shield-checkmark',
  settings:       'settings',
};

function FallbackTabBarIcon({ routeName, color, size }: Readonly<{ routeName: string; color: string; size: number }>) {
  return <Ionicons name={FALLBACK_ICONS[routeName] ?? 'ellipse'} size={size} color={color} />;
}

function getFallbackScreenOptions(routeName: string) {
  return {
    headerShown: false,
    tabBarActiveTintColor: Colors.brand.primary,
    tabBarInactiveTintColor: Colors.ui.textMuted,
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <FallbackTabBarIcon routeName={routeName} color={color} size={size} />
    ),
  };
}

export default function TabsLayout() {
  const hydrated = useStoreHydrated();
  const isDone = useIsOnboardingDone();
  const previewMode = usePreviewMode();
  const { t } = useTranslation();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.ui.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={Colors.brand.primary} size="large" />
      </View>
    );
  }

  if (!isDone && !previewMode) return <Redirect href="/(onboarding)/" />;

  if (USE_NATIVE_TABS) {
    return (
      <NativeTabs>
        {TABS.map((tab) => (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <Label>{t(`tabs.${tab.labelKey}`)}</Label>
            <Icon sf={tab.sfSymbol} drawable={tab.drawable} />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  // Fallback: standard Expo Router Tabs (iOS 18 dev client + web)
  return (
    <Tabs
      screenOptions={({ route }) => getFallbackScreenOptions(route.name)}
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
