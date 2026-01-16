import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import './src/i18n';
import { initDB } from './src/services/database';
import { initSentry, addBreadcrumb } from './src/services/sentry';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { SyncProvider } from './src/contexts/SyncContext';
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

// Initialize Sentry early
initSentry();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
          borderTopColor: '#E4E7EC',
          paddingBottom: 8,
          paddingTop: 8,
          height: 80,
        },
        tabBarActiveTintColor: '#0B5FFF',
        tabBarInactiveTintColor: '#667085',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Create" component={CreateInvoiceScreen} />
      <Tab.Screen name="Invoices" component={InvoicesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    addBreadcrumb({
      category: 'lifecycle',
      message: 'App mounted',
      level: 'info',
    });
    void initDB().catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
      <NetworkProvider>
        <SyncProvider>
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
                <AppNavigator />
              </NavigationContainer>
            </OnboardingProvider>
          </LoadingProvider>
        </SyncProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
