import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import './src/i18n';
import { initDB } from './src/services/database';
import { initSentry, addBreadcrumb } from './src/services/sentry';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import SplashScreen from './src/screens/SplashScreen';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { DeviceProvider } from './src/contexts/DeviceContext';
import { SyncProvider } from './src/contexts/SyncContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { OnboardingProvider, useOnboarding } from './src/contexts/OnboardingContext';
import LoadingOverlay from './src/components/LoadingOverlay';
import NetworkStatus from './src/components/NetworkStatus';
import HomeScreen from './src/screens/HomeScreen';
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { colors, spacing, typography } from './src/theme/tokens';

// Initialize Sentry early
initSentry();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BootRouter() {
  const { isHydrated } = useAuth();

  if (!isHydrated) {
    return null;
  }

  return <AppNavigator />;
}

function AppNavigator() {
  const { isOnboardingComplete } = useOnboarding();

  if (!isOnboardingComplete) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
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
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>🏠</Text>
            </View>
          ),
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen 
        name="Create" 
        component={CreateInvoiceScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>➕</Text>
            </View>
          ),
          tabBarAccessibilityLabel: 'Create invoice tab',
        }}
      />
      <Tab.Screen 
        name="Invoices" 
        component={InvoicesScreen}
        options={{
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>📄</Text>
            </View>
          ),
          tabBarAccessibilityLabel: 'Invoices list tab',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: size, color }}>⚙️</Text>
            </View>
          ),
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootData, setBootData] = useState<{ deviceInfo: any; persistedState: any } | null>(null);

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
                    <NavigationContainer
                      onStateChange={(state) => {
                        const currentRoute = state?.routes[state.index]?.name;
                        if (currentRoute) {
                          addBreadcrumb({
                            category: 'navigation',
                            message: `Navigated to ${currentRoute}`,
                            level: 'info',
                          });
                        }
                      }}
                    >
                      <StatusBar style="dark" />
                    <NetworkStatus />
                    <LoadingOverlay />
                    <BootRouter />
                  </NavigationContainer>
                </OnboardingProvider>
              </LoadingProvider>
            </FeatureFlagProvider>
          </AuthProvider>
        </SyncProvider>
      </DeviceProvider>
    </NetworkProvider>
  </ErrorBoundary>
  );
}
