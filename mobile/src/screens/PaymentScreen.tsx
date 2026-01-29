import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { LoadingContext } from '../contexts/LoadingContext';
import { useNetwork } from '../contexts/NetworkContext';
import { getAccessToken } from '../services/authTokens';
import { colors } from '../theme/tokens';

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

  const validateInputs = (): boolean => {
    if (!payerName.trim()) {
      Alert.alert(t('payment.validationError'), t('payment.enterPayerName'));
      return false;
    }
    if (!payerEmail.trim() || !payerEmail.includes('@')) {
      Alert.alert(t('payment.validationError'), t('payment.enterValidEmail'));
      return false;
    }
    if (!payerPhone.trim() || payerPhone.length < 10) {
      Alert.alert(t('payment.validationError'), t('payment.enterValidPhone'));
      return false;
    }
    return true;
  };

  const handleGenerateRRR = async () => {
    if (!validateInputs()) return;

    if (!isOnline) {
      Alert.alert(t('alerts.offline'), t('payment.offlineRRR'));
      return;
    }

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
                    Alert.alert(t('payment.error'), t('payment.cannotOpenURL'));
                  }
                }
              } catch (err) {
                Alert.alert(t('payment.error'), t('payment.failedOpenLink'));
              }
            }
          }
        ]
      );
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const rawMessage = error?.message || 'Failed to generate RRR';
      const cleanMessage = typeof rawMessage === 'string' ? rawMessage.replace(/^API error\s+\d{3}:\s*/i, '') : String(rawMessage);
      Alert.alert(t('payment.error'), cleanMessage);
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
      Alert.alert(t('alerts.offline'), t('payment.offlineStatus'));
      return;
    }

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

      Alert.alert(
        'Payment Status',
        `Current status: ${status.toUpperCase()}\n\nIf you've completed payment on Remita, the status will update shortly.`,
        [{ text: 'OK' }]
      );

      if (status === 'paid') {
        setTimeout(() => {
          if (isMountedRef.current) navigation.goBack();
        }, 2000);
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const rawMessage = error?.message || 'Failed to check status';
      const cleanMessage = typeof rawMessage === 'string' ? rawMessage.replace(/^API error\s+\d{3}:\s*/i, '') : String(rawMessage);
      Alert.alert('Error', cleanMessage);
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
        <Text style={styles.subtitle}>via Remita</Text>
      </View>

      <View style={styles.invoiceInfo}>
        <Text style={styles.label}>Invoice ID</Text>
        <Text style={styles.value}>{invoice.id.slice(0, 8).toUpperCase()}</Text>

        {invoice.customerName && (
          <>
            <Text style={styles.label}>Customer</Text>
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
              style={styles.input}
              placeholder={t('payment.payerNamePlaceholder')}
              value={payerName}
              onChangeText={setPayerName}
              editable={!loading}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('payment.payerEmail')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('payment.payerEmailPlaceholder')}
              value={payerEmail}
              onChangeText={setPayerEmail}
              keyboardType="email-address"
              editable={!loading}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('payment.payerPhone')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('payment.payerPhonePlaceholder')}
              value={payerPhone}
              onChangeText={setPayerPhone}
              keyboardType="phone-pad"
              editable={!loading}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleGenerateRRR}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
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
              <ActivityIndicator color={colors.textOnPrimary} />
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
            <Text style={styles.secondaryButtonText}>Generate Different RRR</Text>
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
    padding: 16
  },
  header: {
    marginBottom: 24,
    paddingTop: 12
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '500'
  },
  invoiceInfo: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  value: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  amountValue: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 8
  },
  formSection: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textSecondary
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: colors.primary
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18
  },
  successSection: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  rrrBox: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 16
  },
  rrrLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  rrrValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
    fontFamily: 'monospace'
  },
  rrrHint: {
    fontSize: 12,
    color: colors.textMuted
  },
  instructionsBox: {
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8
  },
  instructionStep: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 18
  }
});
