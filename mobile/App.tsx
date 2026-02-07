import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import i18n from './src/i18n';
import { initDB } from './src/services/database';
import { initSentry, addBreadcrumb } from './src/services/sentry';

// Suppress Reanimated strict-mode warnings ("Reading from 'value' during render")
// These are benign on web and flood the console. Must be called before any Reanimated usage.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});
import { trackNavigation, trackScreenView } from './src/services/analytics';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import SplashScreen from './src/screens/SplashScreen';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { DeviceProvider } from './src/contexts/DeviceContext';
import { SyncProvider } from './src/contexts/SyncContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { OnboardingProvider, useOnboarding } from './src/contexts/OnboardingContext';
import { ToastProvider } from './src/providers/ToastProvider';
import LoadingOverlay from './src/components/LoadingOverlay';
import NetworkStatus from './src/components/NetworkStatus';
import HomeScreen from './src/screens/HomeScreen';
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TaxGuideScreen from './src/screens/TaxGuideScreen';
import { colors, spacing, typography } from './src/theme/tokens';
import { screenTransitions } from './src/navigation/transitions';

// Initialize Sentry early
initSentry();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BootRouter() {
  const { isHydrated } = useAuth();

  if (!isHydrated) {
    // Show branded loading state during hydration instead of blank screen
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 48 }}>📊</Text>
      </View>
    );
  }

  return <AppNavigator />;
}

function AppNavigator() {
  const { isOnboardingComplete } = useOnboarding();

  if (!isOnboardingComplete) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, ...screenTransitions.slideFromRight }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...screenTransitions.slideFromRight }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="TaxGuide"
        component={TaxGuideScreen}
        options={screenTransitions.slideFromRight}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopColor: colors.borderSubtle,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
          height: 80,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.semibold,
          maxWidth: 70,
        },
        tabBarItemStyle: {
          flex: 1,
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: t('navigation.home'),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>🏠</Text>
            </View>
          ),
          tabBarAccessibilityLabel: t('navigation.homeTab'),
        }}
      />
      <Tab.Screen 
        name="Create" 
        component={CreateInvoiceScreen}
        options={{
          tabBarLabel: t('navigation.create'),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>➕</Text>
            </View>
          ),
          tabBarAccessibilityLabel: t('navigation.createTab'),
        }}
      />
      <Tab.Screen 
        name="Invoices" 
        component={InvoicesScreen}
        options={{
          tabBarLabel: t('navigation.invoices'),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>📄</Text>
            </View>
          ),
          tabBarAccessibilityLabel: t('navigation.invoicesTab'),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          lazy: true,
          tabBarLabel: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>⚙️</Text>
            </View>
          ),
          tabBarAccessibilityLabel: t('navigation.settingsTab'),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootData, setBootData] = useState<{ deviceInfo: any; persistedState: any } | null>(null);
  const routeNameRef = useRef<string | null>(null);
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);

  useEffect(() => {
    addBreadcrumb({
      category: 'lifecycle',
      message: 'App mounted',
      level: 'info',
    });
    void initDB().catch(() => undefined);
  }, []);

  if (!booted) {
    return <SplashScreen onFinish={(data) => {
      setBootData(data || null);
      setBooted(true);
    }} />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <NetworkProvider>
          <DeviceProvider 
            initialDeviceInfo={bootData?.deviceInfo}
            initialPersistedState={bootData?.persistedState}
          >
            <SyncProvider>
              <AuthProvider>
                <FeatureFlagProvider>
                  <LoadingProvider>
                    <OnboardingProvider>
                      <ToastProvider>
                        <NavigationContainer
                          ref={navigationRef}
                          onReady={() => {
                            const currentRoute = navigationRef.current?.getCurrentRoute()?.name || null;
                            routeNameRef.current = currentRoute;
                            if (currentRoute) {
                              void trackScreenView(currentRoute);
                            }
                          }}
                          onStateChange={(state) => {
                            const currentRoute = state?.routes[state.index]?.name;
                            if (!currentRoute || currentRoute === routeNameRef.current) {
                              return;
                            }

                            const previousRoute = routeNameRef.current;
                            if (previousRoute) {
                              void trackNavigation(previousRoute, currentRoute, 'button');
                            }
                            routeNameRef.current = currentRoute;
                            void trackScreenView(currentRoute);
                            addBreadcrumb({
                              category: 'navigation',
                              message: `Navigated to ${currentRoute}`,
                              level: 'info',
                            });
                          }}
                        >
                          <StatusBar style="dark" />
                          <NetworkStatus />
                          <LoadingOverlay />
                          <BootRouter />
                        </NavigationContainer>
                      </ToastProvider>
                    </OnboardingProvider>
                  </LoadingProvider>
                </FeatureFlagProvider>
              </AuthProvider>
          </SyncProvider>
        </DeviceProvider>
      </NetworkProvider>
    </ErrorBoundary>
    </I18nextProvider>
  );
}
