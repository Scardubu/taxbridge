import React, { useState, useEffect } from 'react';
import { Toast, ToastConfig, ToastManager } from '../components/ui/Toast';

interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * ToastProvider Component
 * 
 * Provides toast notification system to entire app:
 * - Wraps app root to enable global toast display
 * - Manages toast queue and display lifecycle
 * - Connects ToastManager to React component tree
 * 
 * Usage:
 * ```tsx
 * // In App.tsx:
 * <ToastProvider>
 *   <NavigationContainer>
 *     ...
 *   </NavigationContainer>
 * </ToastProvider>
 * 
 * // Anywhere in app:
 * import { showToast } from '../components/ui/Toast';
 * 
 * showToast({
 *   type: 'success',
 *   message: 'Invoice saved!',
 *   haptic: 'success',
 * });
 * ```
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);

  useEffect(() => {
    // Connect ToastManager to component
    ToastManager._setRef((config) => {
      setCurrentToast(config);
    });

    return () => {
      ToastManager._setRef(() => {});
    };
  }, []);

  return (
    <>
      {children}
      {currentToast && (
        <Toast
          {...currentToast}
          onDismiss={() => ToastManager.dismiss()}
        />
      )}
    </>
  );
};
