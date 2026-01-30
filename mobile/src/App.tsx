import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';

import SplashScreen from './screens/SplashScreen';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthNavigator } from './navigation/AuthNavigator';

import { NetworkProvider } from './contexts/NetworkContext';
import { SyncProvider } from './contexts/SyncContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function BootRouter() {
  const { isAuthenticated, isHydrated } = useAuth();

  // Prevent routing before auth restore
  if (!isHydrated) {
    return null;
  }

  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return (
      <SplashScreen
        onFinish={() => setBooted(true)}
      />
    );
  }

  return (
    <NetworkProvider>
      <SyncProvider>
        <AuthProvider>
          <NavigationContainer>
            <BootRouter />
          </NavigationContainer>
        </AuthProvider>
      </SyncProvider>
    </NetworkProvider>
  );
}
