import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { LoadingContext } from '../contexts/LoadingContext';

interface PaymentScreenProps {
  route: {
    params: {
      invoice: {
        id: string;
        total: number;
        customerName?: string;
      };
    };
  };
}

export default function PaymentScreen({ route }: PaymentScreenProps) {
  const { invoice } = route.params;
  const navigation = useNavigation();
  const { setLoading: setAppLoading } = React.useContext(LoadingContext);

  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [loading, setLocalLoading] = useState(false);
  const [rrr, setRrr] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const validateInputs = (): boolean => {
    if (!payerName.trim()) {
      Alert.alert('Validation Error', 'Please enter payer name');
      return false;
    }
    if (!payerEmail.trim() || !payerEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter valid email');
      return false;
    }
    if (!payerPhone.trim() || payerPhone.length < 10) {
      Alert.alert('Validation Error', 'Please enter valid phone number');
      return false;
    }
    return true;
  };

  const handleGenerateRRR = async () => {
    if (!validateInputs()) return;

    setLocalLoading(true);
    setAppLoading?.(true);
    try {
      const response = await api.post('/payments/generate', {
        invoiceId: invoice.id,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim(),
        payerPhone: payerPhone.trim()
      });

      const { rrr: generatedRRR, paymentUrl: url, amount } = response;

      setRrr(generatedRRR);
      setPaymentUrl(url);

      Alert.alert(
        'Payment Ready',
        `Your RRR: ${generatedRRR}\nAmount: ₦${amount.toFixed(2)}\n\nSecurely proceed to Remita to complete payment.`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              setRrr(null);
              setPaymentUrl(null);
            },
            style: 'cancel'
          },
          {
            text: 'Proceed to Payment',
            onPress: async () => {
              try {
                const { Linking } = await import('react-native');
                if (url) {
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    Alert.alert('Error', 'Cannot open payment URL');
                  }
                }
              } catch (err) {
                Alert.alert('Error', 'Failed to open payment link');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate RRR';
      Alert.alert('Error', errorMessage);
    } finally {
      setLocalLoading(false);
      setAppLoading?.(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!invoice.id) return;

    setLocalLoading(true);
    setAppLoading?.(true);
    try {
      const response = await api.get(`/payments/${invoice.id}/status`);
      const { status } = response;

      Alert.alert(
        'Payment Status',
        `Current status: ${status.toUpperCase()}\n\nIf you've completed payment on Remita, the status will update shortly.`,
        [{ text: 'OK' }]
      );

      if (status === 'paid') {
        setTimeout(() => navigation.goBack(), 2000);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to check status';
      Alert.alert('Error', errorMessage);
    } finally {
      setLocalLoading(false);
      setAppLoading?.(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tax Payment</Text>
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

        <Text style={styles.label}>Amount Due</Text>
        <Text style={styles.amountValue}>₦{invoice.total.toFixed(2)}</Text>
      </View>

      {!rrr ? (
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Payer Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., John Doe"
              value={payerName}
              onChangeText={setPayerName}
              editable={!loading}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., john@example.com"
              value={payerEmail}
              onChangeText={setPayerEmail}
              keyboardType="email-address"
              editable={!loading}
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 08012345678"
              value={payerPhone}
              onChangeText={setPayerPhone}
              keyboardType="phone-pad"
              editable={!loading}
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleGenerateRRR}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Generate Payment Code (RRR)</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By proceeding, you agree to pay the tax amount via Remita's secure payment gateway.
          </Text>
        </View>
      ) : (
        <View style={styles.successSection}>
          <View style={styles.rrrBox}>
            <Text style={styles.rrrLabel}>Your Payment Code (RRR)</Text>
            <Text style={styles.rrrValue}>{rrr}</Text>
            <Text style={styles.rrrHint}>Keep this code for reference</Text>
          </View>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>Next Steps:</Text>
            <Text style={styles.instructionStep}>1. Tap "Proceed to Payment" to go to Remita</Text>
            <Text style={styles.instructionStep}>2. Pay via Bank Transfer, Card, or USSD</Text>
            <Text style={styles.instructionStep}>3. Return to TaxBridge once payment is complete</Text>
            <Text style={styles.instructionStep}>4. Tap "Check Payment Status" to confirm</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Check Payment Status</Text>
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
    backgroundColor: '#f8f9fa',
    padding: 16
  },
  header: {
    marginBottom: 24,
    paddingTop: 12
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: '#667085',
    fontWeight: '500'
  },
  invoiceInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e4e7ec'
  },
  label: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  value: {
    fontSize: 16,
    color: '#1d2939',
    fontWeight: '600'
  },
  amountValue: {
    fontSize: 24,
    color: '#0b5fff',
    fontWeight: '700',
    marginTop: 8
  },
  formSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e7ec'
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d2939',
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#f2f4f7',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1d2939'
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: '#0b5fff'
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  secondaryButtonText: {
    color: '#0b5fff',
    fontSize: 14,
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  disclaimer: {
    fontSize: 12,
    color: '#667085',
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18
  },
  successSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e7ec'
  },
  rrrBox: {
    backgroundColor: '#f0f3ff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0b5fff',
    marginBottom: 16
  },
  rrrLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  rrrValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0b5fff',
    marginBottom: 4,
    fontFamily: 'monospace'
  },
  rrrHint: {
    fontSize: 12,
    color: '#667085'
  },
  instructionsBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d2939',
    marginBottom: 8
  },
  instructionStep: {
    fontSize: 13,
    color: '#344054',
    marginBottom: 6,
    lineHeight: 18
  }
});
