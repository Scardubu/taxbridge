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
} from 'react-native';
import { captureException, addBreadcrumb } from '../services/sentry';
import { colors, spacing, radii, typography } from '../theme/tokens';
import i18n from '../i18n';

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

    // Also log to console in dev
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
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

  render(): ReactNode {
    const { hasError, error, errorId } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>😔</Text>
            <Text style={styles.title}>{i18n.t('errors.boundary.title')}</Text>
            <Text style={styles.subtitle}>
              {i18n.t('errors.boundary.subtitle')}
            </Text>

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
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>

            {errorId && (
              <Text style={styles.errorId}>Error ID: {errorId}</Text>
            )}

            <Text style={styles.hint}>
              {i18n.t('errors.boundary.hint')}
            </Text>
          </View>
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
  errorId: {
    fontSize: typography.size.xs,
    fontFamily: 'monospace',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.disabled,
    textAlign: 'center',
  },
});

export default ErrorBoundary;
