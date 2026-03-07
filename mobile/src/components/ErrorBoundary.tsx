/**
 * TaxBridge Mobile - Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI.
 * 
 * Features:
 * - Catches render errors in child components
 * - Reports errors to Sentry
 * - Shows user-friendly error screen
 * - Allows app restart
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Share,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException, addBreadcrumb } from '../services/sentry';
import { colors, spacing, radii, typography } from '../theme/tokens';
import i18n from '../i18n';

const ERROR_LOGS_KEY = '@taxbridge:error_logs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `TB-${Date.now().toString(36).toUpperCase()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to Sentry
    addBreadcrumb({
      category: 'error-boundary',
      message: 'Component error caught',
      level: 'error',
      data: { componentStack: errorInfo.componentStack },
    });

    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      errorId: this.state.errorId,
    });

    this.setState({ errorInfo });

    // Save error to AsyncStorage for later reporting
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    };
    this.saveErrorLog(errorDetails);

    // Also log to console in dev
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  async saveErrorLog(errorDetails: any): Promise<void> {
    try {
      const existingLogs = await AsyncStorage.getItem(ERROR_LOGS_KEY);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push(errorDetails);
      
      // Keep only last 10 errors
      const recentLogs = logs.slice(-10);
      
      await AsyncStorage.setItem(ERROR_LOGS_KEY, JSON.stringify(recentLogs));
    } catch (error) {
      if (__DEV__) console.error('[ErrorBoundary] Failed to save error log:', error);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleContactSupport = (): void => {
    const { errorId } = this.state;
    const message = `Hi TaxBridge Support, I encountered an error in the app.\nError ID: ${errorId || 'unknown'}\nPlease help me resolve this.`;
    const whatsappUrl = `https://wa.me/2348012345678?text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappUrl).catch(() => {});
  };

  handleShareError = async (): Promise<void> => {
    const { error, errorId } = this.state;
    
    try {
      await Share.share({
        message: `TaxBridge Error Report\n\nError ID: ${errorId || 'unknown'}\nMessage: ${error?.message || 'Unknown error'}\nTime: ${new Date().toLocaleString()}\n\nPlease share this with TaxBridge support.`,
        title: 'TaxBridge Error Report',
      });
    } catch (error) {
      if (__DEV__) console.error('[ErrorBoundary] Failed to share error:', error);
    }
  };

  render(): ReactNode {
    const { hasError, error, errorId } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.emoji}>😔</Text>
            <Text style={styles.title}>{i18n.t('errors.boundary.title')}</Text>
            <Text style={styles.subtitle}>
              {i18n.t('errors.boundary.subtitle')}
            </Text>

            <View style={styles.reassuranceBox}>
              <Text style={styles.reassuranceIcon}>✓</Text>
              <View style={styles.reassuranceContent}>
                <Text style={styles.reassuranceTitle}>{i18n.t('errors.boundary.dataSafe')}</Text>
                <Text style={styles.reassuranceText}>
                  {i18n.t('errors.boundary.dataSafeDesc')}
                </Text>
              </View>
            </View>

            {errorId && (
              <View style={styles.errorIdBox}>
                <Text style={styles.errorIdLabel}>{i18n.t('errors.boundary.errorIdLabel')}</Text>
                <Text style={styles.errorIdText}>{errorId}</Text>
              </View>
            )}

            {__DEV__ && error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{i18n.t('errors.boundary.details')}</Text>
                <Text style={styles.errorText} numberOfLines={5}>
                  {error.message}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>{i18n.t('errors.boundary.tryAgain')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportButton} onPress={this.handleContactSupport}>
              <Text style={styles.supportButtonText}>{i18n.t('errors.boundary.contactSupport')}</Text>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity style={styles.shareButton} onPress={this.handleShareError}>
                <Text style={styles.shareButtonText}>{i18n.t('errors.boundary.shareReport')}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.hint}>
              {i18n.t('errors.boundary.hint')}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold as any,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
    maxWidth: 300,
  },
  errorBox: {
    backgroundColor: colors.errorBgSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
    color: colors.errorDark,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.xs,
    fontFamily: 'monospace',
    color: colors.error,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
  },
  supportButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  supportButtonText: {
    color: colors.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
    textAlign: 'center',
  },
  reassuranceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successBgSubtle,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.success,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 300,
  },
  reassuranceIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  reassuranceContent: {
    flex: 1,
  },
  reassuranceTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
    color: colors.successDark,
    marginBottom: 4,
  },
  reassuranceText: {
    fontSize: typography.size.sm,
    color: colors.successDark,
  },
  errorIdBox: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 300,
  },
  errorIdLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  errorIdText: {
    fontSize: typography.size.sm,
    fontFamily: 'monospace',
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold as any,
  },
  errorId: {
    fontSize: typography.size.xs,
    fontFamily: 'monospace',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  shareButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  shareButtonText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium as any,
    textAlign: 'center',
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.disabled,
    textAlign: 'center',
  },
});

export default ErrorBoundary;
