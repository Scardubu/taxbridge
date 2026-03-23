import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
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

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😓</Text>
        <Text style={styles.title}>Wahala dey — something break small</Text>
        <Text style={styles.body}>Your progress don save. You fit continue later.</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        {this.state.errorId ? <Text style={styles.errorId}>Error ID: {this.state.errorId}</Text> : null}
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
