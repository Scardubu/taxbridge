import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getBusinessProfile } from '../../services/businessApi';
import { processPayroll } from '../../services/payrollApi';
import { tokens } from '../../constants/tokens';

function getCurrentPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export default function CreatePayrollScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getBusinessProfile()
      .then((profile) => {
        if (!active) return;
        setBusinessId(profile.id);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load business profile');
      })
      .finally(() => {
        if (!active) return;
        setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const isValidPeriod = useMemo(() => /^\d{4}-\d{2}$/.test(period.trim()), [period]);

  const handleSubmit = async () => {
    if (!businessId) {
      Alert.alert('Business not ready', 'Please wait for your business profile to finish loading.');
      return;
    }

    if (!isValidPeriod) {
      Alert.alert('Invalid period', 'Enter the payroll period in YYYY-MM format.');
      return;
    }

    setSubmitting(true);
    try {
      const { payroll } = await processPayroll(businessId, period.trim());
      Alert.alert('Payroll created', `Payroll for ${payroll.period} was processed successfully.`, [
        {
          text: 'View payroll',
          onPress: () => (navigation as any).replace('PayrollDetail', { id: payroll.id }),
        },
        {
          text: 'Back to payroll',
          style: 'cancel',
          onPress: () => (navigation as any).goBack(),
        },
      ]);
    } catch (err) {
      Alert.alert(
        'Payroll failed',
        err instanceof Error ? err.message : 'Unable to process payroll right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Process Payroll</Text>
        <Text style={styles.subtitle}>
          Run payroll for a month in `YYYY-MM` format using your active business profile.
        </Text>

        <Text style={styles.label}>Payroll period</Text>
        <TextInput
          value={period}
          onChangeText={setPeriod}
          placeholder="2026-03"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholderTextColor={tokens.colors.neutral[400]}
        />

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>What happens next</Text>
          <Text style={styles.hintText}>Employees are fetched from your current business.</Text>
          <Text style={styles.hintText}>PAYE, pension, and NHF values are computed server-side.</Text>
          <Text style={styles.hintText}>You’ll be taken to the generated payroll summary after success.</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!businessId || submitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!businessId || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={tokens.colors.white} />
          ) : (
            <Text style={styles.buttonText}>Process payroll</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[50],
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[50],
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    ...tokens.shadows.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.neutral[600],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[800],
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    fontSize: 16,
    color: tokens.colors.neutral[900],
    backgroundColor: tokens.colors.white,
  },
  hintBox: {
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  hintTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.neutral[800],
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.neutral[600],
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.danger,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.lg,
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.white,
  },
});
