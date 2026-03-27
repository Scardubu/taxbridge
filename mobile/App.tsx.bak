import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type NavigationState,
  type PartialState,
  DefaultTheme,
} from '@react-navigation/native';

// Prevent the native splash from auto-hiding until we're ready
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not available — safe to ignore
});

// Force light theme to prevent dark mode flash on Android
const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    primary: '#0B5FFF',
  },
};
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import i18n from './src/i18n';
import { initDB } from './src/services/database';
import { initSentry, addBreadcrumb } from './src/services/sentry';

// Suppress Reanimated strict-mode warnings ("Reading from 'value' during render")
// These are benign on web and flood the console. Must be called before any Reanimated usage.
try {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  });
} catch {
  // Safe to ignore — older versions of Reanimated do not export configureReanimatedLogger
}
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
import { ThemeProvider } from './src/contexts/ThemeContext';
import { ToastProvider } from './src/providers/ToastProvider';
import LoadingOverlay from './src/components/LoadingOverlay';
import BrandedLoading from './src/components/BrandedLoading';
import NetworkStatus from './src/components/NetworkStatus';
import DashboardScreen from './src/screens/tabs/DashboardScreen';
// HomeScreen retired in V10.3 — DashboardScreen (composite hook) is the Home tab
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import OnboardingWizard from './src/screens/OnboardingWizard';
import { LoginScreen, RegisterScreen } from './src/screens/auth/AuthScreens';
import TaxGuideScreen from './src/screens/TaxGuideScreen';
import PayrollListScreen from './src/screens/Payroll/PayrollListScreen';
import CreatePayrollScreen from './src/screens/Payroll/CreatePayrollScreen';
import PayrollDetailScreen from './src/screens/Payroll/PayrollDetailScreen';
import ComplianceRemindersScreen from './src/screens/Compliance/ComplianceRemindersScreen';
import CryptoTaxScreen from './src/screens/Crypto/CryptoTaxScreen';
import ReconciliationScreen from './src/screens/Reconciliation/ReconciliationScreen';
import DocumentVaultScreen from './src/screens/documents/DocumentVaultScreen';
import TeamManagementScreen from './src/screens/team/TeamManagementScreen';
import { colors, spacing, typography } from './src/theme/tokens';
import { screenTransitions } from './src/navigation/transitions';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { useDeepLink } from './src/hooks/useDeepLink';

// Initialize Sentry early
initSentry();

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function getActiveRouteNameFromState(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | null {
  if (!state?.routes?.length) {
    return null;
  }

  const route = state.routes[state.index ?? 0] as {
    name: string;
    state?: NavigationState | PartialState<NavigationState>;
  };

  if (route.state) {
    return getActiveRouteNameFromState(route.state);
  }

  return route.name;
}

function getCurrentRouteName(
  navigation: NavigationContainerRef<RootStackParamList> | null,
): string | null {
  return getActiveRouteNameFromState(navigation?.getRootState());
}

function DeepLinkBridge({ navigationRef }: { navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null> }) {
  useDeepLink(navigationRef);
  return null;
}

function BootRouter() {
  const { isHydrated } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Safety timeout: if hydration takes >5 seconds, show app anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isHydrated) {
        setLoadingTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isHydrated]);

  if (!isHydrated && !loadingTimeout) {
    return <BrandedLoading />;
  }

  return <AppNavigator />;
}

function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { isOnboardingComplete, isLoading } = useOnboarding();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Safety timeout: if onboarding loading takes >5 seconds, proceed anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setLoadingTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Show loading state while onboarding data loads from storage
  if (isLoading && !loadingTimeout) {
    return <BrandedLoading />;
  }

  if (!isAuthenticated && !isOnboardingComplete) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, ...screenTransitions.slideFromRight }}>
        <Stack.Screen name="Onboarding" component={OnboardingWizard} />
      </Stack.Navigator>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, ...screenTransitions.slideFromRight }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...screenTransitions.slideFromRight }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
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
      <Stack.Screen
        name="Payroll"
        component={PayrollListScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="CreatePayroll"
        component={CreatePayrollScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="PayrollDetail"
        component={PayrollDetailScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="Compliance"
        component={ComplianceRemindersScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="Crypto"
        component={CryptoTaxScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="Reconciliation"
        component={ReconciliationScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="Documents"
        component={DocumentVaultScreen}
        options={screenTransitions.slideFromRight}
      />
      <Stack.Screen
        name="Team"
        component={TeamManagementScreen}
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
        component={DashboardScreen}
        options={{
          tabBarLabel: t('navigation.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
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
            <Ionicons name="add-circle" size={size} color={color} />
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
            <Ionicons name="document-text" size={size} color={color} />
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
            <Ionicons name="settings" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: t('navigation.settingsTab'),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // BUG-S01: Load Inter + Ionicons fonts before rendering to prevent □ squares
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<Error | null>(null);
  const [bootData, setBootData] = useState<{ deviceInfo: any; persistedState: any } | null>(null);
  const [bootTimeoutReached, setBootTimeoutReached] = useState(false);
  const routeNameRef = useRef<string | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);

  // Safety timeout: force boot completion after 10 seconds max
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!booted) {
        setBootTimeoutReached(true);
        // Force boot to complete even if SplashScreen didn't finish properly
        setBooted(true);
      }
    }, 10000); // 10 second max boot time

    return () => clearTimeout(safetyTimer);
  }, [booted]);

  useEffect(() => {
    addBreadcrumb({
      category: 'lifecycle',
      message: 'App mounted',
      level: 'info',
    });
    // Initialize DB in background - don't block boot
    void initDB().catch((err) => {
      addBreadcrumb({
        category: 'database',
        message: 'DB init error (non-fatal)',
        data: { error: String(err) },
        level: 'warning',
      });
    });
  }, []);

  // Hide the native expo splash screen once booted
  useEffect(() => {
    if (booted) {
      ExpoSplashScreen.hideAsync().catch(() => undefined);
    }
  }, [booted]);

  // BUG-S01: Hold on splash until fonts are loaded to prevent □ icon flash
  if (!booted || !fontsLoaded) {
    return <SplashScreen onFinish={(data) => {
      try {
        setBootData(data || null);
        setBooted(true);
      } catch (err) {
        setBootError(err instanceof Error ? err : new Error(String(err)));
        setBooted(true);
      }
    }} />;
  }

  // If boot failed or timeout reached, show a minimal recovery screen but still allow app use
  if (bootError || bootTimeoutReached) {
    // Don't block the app - just log the error and continue
    if (bootError) {
      addBreadcrumb({
        category: 'boot',
        message: 'Boot error occurred but continuing',
        data: { error: bootError.message },
        level: 'warning',
      });
    }
    // Continue to main app instead of showing error screen
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <ThemeProvider>
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
                          theme={LightTheme}
                          onReady={() => {
                            const currentRoute = getCurrentRouteName(navigationRef.current);
                            routeNameRef.current = currentRoute;
                            if (currentRoute) {
                              void trackScreenView(currentRoute);
                            }
                          }}
                          onStateChange={(state) => {
                            const currentRoute = getActiveRouteNameFromState(state);
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
                          <DeepLinkBridge navigationRef={navigationRef} />
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
        </ThemeProvider>
    </ErrorBoundary>
    </I18nextProvider>
  );
}
