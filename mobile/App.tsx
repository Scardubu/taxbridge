import { useEffect } from 'react';
import { StatusBar, View } from 'expo-status-bar';
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
import LoadingOverlay from './src/components/LoadingOverlay';
import NetworkStatus from './src/components/NetworkStatus';
import HomeScreen from './src/screens/HomeScreen';
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaymentScreen from './src/screens/PaymentScreen';

// Initialize Sentry early
initSentry();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={TabNavigator} />
                <Stack.Screen
                  name="Payment"
                  component={PaymentScreen}
                  options={{ animationEnabled: true }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </LoadingProvider>
        </SyncProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
