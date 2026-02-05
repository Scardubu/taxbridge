import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { LoadingContext } from '../contexts/LoadingContext';
import { useNetwork } from '../contexts/NetworkContext';
import { getAccessToken } from '../services/authTokens';
import { showToast } from '../components/ui/Toast';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { colors, spacing, radii, typography } from '../theme/tokens';

type PaymentRouteParams = {
  Payment: {
    invoice: {
      id: string;
      total: number;
      customerName?: string;
    };
  };
};

interface PaymentScreenProps {
  route?: {
    params?: {
      invoice?: {
        id: string;
        total: number;
        customerName?: string;
      };
    };
  };
}

export default function PaymentScreen({ route: propRoute }: PaymentScreenProps = {}) {
  const { t } = useTranslation();
  // Get invoice from props or navigation route
  const getInvoice = () => {
    if (propRoute?.params?.invoice) {
      return propRoute.params.invoice;
    }
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const hookRoute = useRoute<RouteProp<PaymentRouteParams, 'Payment'>>();
      return hookRoute?.params?.invoice ?? { id: '', total: 0, customerName: '' };
    } catch {
      return { id: '', total: 0, customerName: '' };
    }
  };
  
  const invoice = getInvoice();
  const navigation = useNavigation();
  const { setLoading: setAppLoading } = React.useContext(LoadingContext);
  const { isOnline } = useNetwork();
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [loading, setLocalLoading] = useState(false);
  const [rrr, setRrr] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  
  // Focus management refs
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const validateInputs = (): boolean => {
    if (!payerName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        type: 'error',
        message: t('payment.enterPayerName'),
        haptic: 'error',
      });
      nameInputRef.current?.focus();
      return false;
    }
    if (!payerEmail.trim() || !payerEmail.includes('@')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        type: 'error',
        message: t('payment.enterValidEmail'),
        haptic: 'error',
      });
      emailInputRef.current?.focus();
      return false;
    }
    if (!payerPhone.trim() || payerPhone.length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        type: 'error',
        message: t('payment.enterValidPhone'),
        haptic: 'error',
      });
      phoneInputRef.current?.focus();
      return false;
    }
    return true;
  };

  const handleGenerateRRR = async () => {
    if (!validateInputs()) return;

    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        type: 'warning',
        message: t('payment.offlineRRR'),
        haptic: 'warning',
      });
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const token = await getAccessToken();
    if (!token) {
      Alert.alert(
        t('payment.signInRequired'),
        t('payment.signInRequiredDesc'),
        [
          { text: t('settings.cancel'), style: 'cancel' },
          {
            text: t('payment.goToSettings'),
            onPress: () => {
              try {
                // Navigate to Settings tab inside MainTabs
                (navigation as any).navigate('MainTabs', { screen: 'Settings' });
              } catch {
                // no-op
              }
            }
          }
        ]
      );
      return;
    }

    if (isMountedRef.current) {
      setLocalLoading(true);
      setAppLoading?.(true);
    }
    try {
      const idempotencyKey = invoice.id ? `payment:${invoice.id}` : undefined;
      const response = await api.post(
        '/payments/generate',
        {
          invoiceId: invoice.id,
          payerName: payerName.trim(),
          payerEmail: payerEmail.trim(),
          payerPhone: payerPhone.trim()
        },
        { idempotencyKey, retries: 2 }
      );

      if (!isMountedRef.current) return;

      const { rrr: generatedRRR, paymentUrl: url, amount } = response;

      setRrr(generatedRRR);
      setPaymentUrl(url);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('payment.paymentReady'),
        t('payment.paymentReadyDesc', { rrr: generatedRRR, amount: amount.toFixed(2) }),
        [
          {
            text: t('settings.cancel'),
            onPress: () => {
              setRrr(null);
              setPaymentUrl(null);
            },
            style: 'cancel'
          },
          {
            text: t('payment.proceedToPayment'),
            onPress: async () => {
              try {
                const { Linking } = await import('react-native');
                if (url) {
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    showToast({
                      type: 'error',
                      message: t('payment.cannotOpenURL'),
                      haptic: 'error',
                    });
                  }
                }
              } catch (err) {
                showToast({
                  type: 'error',
                  message: t('payment.failedOpenLink'),
                  haptic: 'error',
                });
              }
            }
          }
        ]
      );
    } catch (error: any) {
      if (!isMountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const rawMessage = error?.message || t('payment.generateFailed');
      const cleanMessage = typeof rawMessage === 'string' ? rawMessage.replace(/^API error\s+\d{3}:\s*/i, '') : String(rawMessage);
      showToast({
        type: 'error',
        message: cleanMessage,
        haptic: 'error',
        duration: 5000,
      });
    } finally {
      if (isMountedRef.current) {
        setLocalLoading(false);
        setAppLoading?.(false);
      }
    }
  };

  const handleCheckStatus = async () => {
    if (!invoice.id) return;

    if (!isOnline) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        type: 'warning',
        message: t('payment.offlineStatus'),
        haptic: 'warning',
      });
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const token = await getAccessToken();
    if (!token) {
      Alert.alert(
        t('payment.signInRequired'),
        t('payment.signInRequiredDesc'),
        [
          { text: t('settings.cancel'), style: 'cancel' },
          {
            text: t('payment.goToSettings'),
            onPress: () => {
              try {
                (navigation as any).navigate('MainTabs', { screen: 'Settings' });
              } catch {
                // no-op
              }
            }
          }
        ]
      );
      return;
    }

    if (isMountedRef.current) {
      setLocalLoading(true);
      setAppLoading?.(true);
    }
    try {
      const response = await api.get(`/payments/${invoice.id}/status`);
      
      if (!isMountedRef.current) return;
      
      const { status } = response;
      Haptics.notificationAsync(
        status === 'paid' 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
      Alert.alert(
        t('payment.statusTitle'),
        t('payment.statusMessage', { status: status.toUpperCase() }),
        [{ text: t('common.ok') }]
      );

      if (status === 'paid') {
        setTimeout(() => {
          if (isMountedRef.current) navigation.goBack();
        }, 2000);
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const rawMessage = error?.message || t('payment.statusFailed');
      const cleanMessage = typeof rawMessage === 'string' ? rawMessage.replace(/^API error\s+\d{3}:\s*/i, '') : String(rawMessage);
      showToast({
        type: 'error',
        message: cleanMessage,
        haptic: 'error',
        duration: 5000,
      });
    } finally {
      if (isMountedRef.current) {
        setLocalLoading(false);
        setAppLoading?.(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('payment.title')}</Text>
        <Text style={styles.subtitle}>{t('payment.viaRemita')}</Text>
      </View>

      <View style={styles.invoiceInfo}>
        <Text style={styles.label}>{t('payment.invoiceIdLabel')}</Text>
        <Text style={styles.value}>{invoice.id.slice(0, 8).toUpperCase()}</Text>

        {invoice.customerName && (
          <>
            <Text style={styles.label}>{t('payment.customerLabel')}</Text>
            <Text style={styles.value}>{invoice.customerName}</Text>
          </>
        )}

        <Text style={styles.label}>{t('payment.invoiceTotal')}</Text>
        <Text style={styles.amountValue}>₦{invoice.total.toFixed(2)}</Text>
      </View>

      {!rrr ? (
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>{t('payment.payerInfoTitle')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('payment.payerName')} *</Text>
            <TextInput
              ref={nameInputRef}
              style={styles.input}
              placeholder={t('payment.payerNamePlaceholder')}
              value={payerName}
              onChangeText={setPayerName}
              editable={!loading}
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => emailInputRef.current?.focus()}
              accessibilityLabel={t('payment.payerName')}
              accessibilityHint={t('payment.payerNamePlaceholder')}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('payment.payerEmail')} *</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder={t('payment.payerEmailPlaceholder')}
              value={payerEmail}
              onChangeText={setPayerEmail}
              keyboardType="email-address"
              editable={!loading}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => phoneInputRef.current?.focus()}
              accessibilityLabel={t('payment.payerEmail')}
              accessibilityHint={t('payment.payerEmailPlaceholder')}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('payment.payerPhone')} *</Text>
            <TextInput
              ref={phoneInputRef}
              style={styles.input}
              placeholder={t('payment.payerPhonePlaceholder')}
              value={payerPhone}
              onChangeText={setPayerPhone}
              keyboardType="phone-pad"
              editable={!loading}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleGenerateRRR}
              accessibilityLabel={t('payment.payerPhone')}
              accessibilityHint={t('payment.payerPhonePlaceholder')}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleGenerateRRR}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('payment.generateRRR')}
            accessibilityState={{ disabled: loading, busy: loading }}
            accessibilityHint={t('payment.rrrDisclaimer')}
          >
            {loading ? (
              <SkeletonLoader type="button" count={1} />
            ) : (
              <Text style={styles.buttonText}>{t('payment.generateRRR')}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            {t('payment.rrrDisclaimer')}
          </Text>
        </View>
      ) : (
        <View style={styles.successSection}>
          <View style={styles.rrrBox}>
            <Text style={styles.rrrLabel}>{t('payment.rrrLabel')}</Text>
            <Text style={styles.rrrValue}>{rrr}</Text>
            <Text style={styles.rrrHint}>{t('payment.rrrHint')}</Text>
          </View>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>{t('payment.nextSteps')}</Text>
            <Text style={styles.instructionStep}>1. {t('payment.nextStepRemita')}</Text>
            <Text style={styles.instructionStep}>2. {t('payment.nextStepQuote')}</Text>
            <Text style={styles.instructionStep}>3. {t('payment.nextStepReturn')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            {loading ? (
              <SkeletonLoader type="button" count={1} />
            ) : (
              <Text style={styles.buttonText}>{t('payment.checkStatus')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setRrr(null);
              setPaymentUrl(null);
              setPayerName('');
              setPayerEmail('');
              setPayerPhone('');
            }}
          >
            <Text style={styles.secondaryButtonText}>{t('payment.generateDifferent')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  invoiceInfo: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  value: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
  },
  amountValue: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: typography.weight.bold,
    marginTop: spacing.sm,
  },
  formSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  formTitle: {
    ...typography.body,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  button: {
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  buttonText: {
    color: colors.textOnPrimary,
    ...typography.body,
    fontWeight: typography.weight.semibold,
  },
  secondaryButtonText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  successSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rrrBox: {
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  rrrLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  rrrValue: {
    fontSize: 20,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontFamily: 'monospace',
  },
  rrrHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  instructionsBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  instructionsTitle: {
    ...typography.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  instructionStep: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
