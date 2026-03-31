import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import i18next from 'i18next';
import { palette, typography, spacing, radius } from './design-system/tokens';

interface Props {
  stepId: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorId?: string;
}

export class OnboardingErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = String(
      Sentry.captureException(error, {
        contexts: { onboarding: { stepId: this.props.stepId } },
        extra: { componentStack: info.componentStack },
      })
    );
    this.setState({ errorId });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const t = i18next.t.bind(i18next);

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😓</Text>
        <Text style={styles.title}>{t('error.boundaryTitle')}</Text>
        <Text style={styles.body}>{t('error.boundaryBody')}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setState({ hasError: false })}
          accessibilityRole="button"
          accessibilityLabel={t('error.retry')}
        >
          <Text style={styles.buttonText}>{t('error.retry')}</Text>
        </TouchableOpacity>
        {this.state.errorId ? (
          <Text style={styles.errorId}>
            {t('error.errorIdLabel')}: {this.state.errorId}
          </Text>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.h2, color: palette.gray900, textAlign: 'center', marginBottom: spacing.sm },
  body: { ...typography.body, color: palette.gray600, textAlign: 'center', marginBottom: spacing.lg },
  button: { backgroundColor: palette.nrsGreen, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg },
  buttonText: { ...typography.bodyBold, color: palette.white },
  errorId: { ...typography.caption, color: palette.gray400, marginTop: spacing.md },
});
