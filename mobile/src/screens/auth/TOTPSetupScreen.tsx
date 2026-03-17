/**
 * V12 §9.1 — TOTPSetupScreen (GAP-03)
 *
 * QR code display + manual secret + verify code + backup codes flow.
 * Integrates with:
 *   POST /api/v1/auth/totp/setup   → { secret, otpauth_url, qr_data_url }
 *   POST /api/v1/auth/totp/verify  → { backupCodes: string[] }
 *
 * Gate check: grep -q "TOTPSetupScreen" mobile/src/screens/auth/TOTPSetupScreen.tsx
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  Clipboard,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useCurrentUser } from '../../store/authStore';
import { authApi } from '../../api/client';
import {
  Button,
  TextInputField,
} from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TOTPSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

interface TOTPVerifyResponse {
  backupCodes: string[];
}

type SetupStep = 'init' | 'scan' | 'verify' | 'backup' | 'done';

// ── API helpers (use authApi which handles token management) ──────────────────

async function requestSetup(): Promise<TOTPSetupResponse> {
  const res = await authApi.totpSetup();
  return res.data as unknown as TOTPSetupResponse;
}

async function verifyTotpCode(totpCode: string): Promise<TOTPVerifyResponse> {
  const res = await authApi.totpVerify(totpCode);
  return res.data as unknown as TOTPVerifyResponse;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TOTPSetupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();

  const [step, setStep] = useState<SetupStep>('init');
  const [setup, setSetup] = useState<TOTPSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Step 1: Request TOTP secret ──────────────────────────────────────
  const handleStartSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestSetup();
      setSetup(data);
      setStep('scan');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.unknownError', 'Something went wrong');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ── Step 2: Verify TOTP code ─────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verifyTotpCode(code);
      setBackupCodes(data.backupCodes);
      setStep('backup');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.unknownError', 'Something went wrong');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [code, t]);

  // ── Copy secret to clipboard ─────────────────────────────────────────
  const handleCopySecret = useCallback(() => {
    if (!setup?.secret) return;
    Clipboard.setString(setup.secret);
    Alert.alert(
      t('totp.copiedTitle', 'Copied'),
      t('totp.copiedMessage', 'Secret key copied to clipboard'),
    );
  }, [setup, t]);

  // ── Copy backup codes to clipboard ───────────────────────────────────
  const handleCopyBackupCodes = useCallback(() => {
    if (backupCodes.length === 0) return;
    Clipboard.setString(backupCodes.join('\n'));
    Alert.alert(
      t('totp.copiedTitle', 'Copied'),
      t('totp.backupCopiedMessage', 'Backup codes copied to clipboard. Store them safely!'),
    );
  }, [backupCodes, t]);

  // ── Done — navigate back ─────────────────────────────────────────────
  const navigation = useNavigation<any>();
  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // ── Auto-start setup on mount ────────────────────────────────────────
  useEffect(() => {
    if (step === 'init') {
      handleStartSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[6] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.title}>
            {t('totp.title', 'Two-Factor Authentication')}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              'totp.subtitle',
              'Protect your account with an authenticator app',
            )}
          </Text>
        </Animated.View>

        {/* Error */}
        {error ? (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBox}>
            <Text style={styles.errorText}>▲ {error}</Text>
          </Animated.View>
        ) : null}

        {/* ── Step: Loading / Init ─────────────────────────────── */}
        {step === 'init' && (
          <View style={styles.centerBox}>
            <Text style={styles.body}>
              {t('totp.generating', 'Generating your secret key…')}
            </Text>
          </View>
        )}

        {/* ── Step: Scan QR ────────────────────────────────────── */}
        {step === 'scan' && setup && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Text style={styles.sectionTitle}>
              {t('totp.scanTitle', 'Scan this QR code')}
            </Text>
            <Text style={styles.body}>
              {t(
                'totp.scanInstructions',
                'Open your authenticator app (e.g. Google Authenticator) and scan the code below.',
              )}
            </Text>

            {/* QR code image (base64 from server) */}
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: setup.qr_data_url }}
                style={styles.qrImage}
                resizeMode="contain"
                accessibilityLabel={t('totp.qrAccessibility', 'TOTP QR code')}
              />
            </View>

            {/* Manual secret fallback */}
            <Text style={styles.orText}>
              {t('totp.orManual', "Or enter this key manually:")}
            </Text>
            <Pressable onPress={handleCopySecret} style={styles.secretBox}>
              <Text style={styles.secretText} selectable>
                {setup.secret}
              </Text>
              <Text style={styles.copyHint}>
                {t('totp.tapToCopy', 'Tap to copy')}
              </Text>
            </Pressable>

            {/* Proceed to verify */}
            <View style={styles.inputGroup}>
              <TextInputField
                label={t('totp.codeLabel', 'Enter 6-digit code')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                placeholder="000000"
              />
              <Button
                label={t('totp.verifyButton', 'Verify & Activate')}
                onPress={handleVerify}
                disabled={code.length < 6 || loading}
                loading={loading}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Step: Backup Codes ──────────────────────────────── */}
        {step === 'backup' && backupCodes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Text style={styles.sectionTitle}>
              {t('totp.backupTitle', 'Save your backup codes')}
            </Text>
            <Text style={styles.body}>
              {t(
                'totp.backupInstructions',
                'Store these codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.',
              )}
            </Text>

            <View style={styles.codesGrid}>
              {backupCodes.map((c, i) => (
                <View key={i} style={styles.codeChip}>
                  <Text style={styles.codeText}>{c}</Text>
                </View>
              ))}
            </View>

            <Button
              label={t('totp.copyBackup', 'Copy All Codes')}
              onPress={handleCopyBackupCodes}
              variant="outline"
            />

            <View style={{ height: spacing[4] }} />

            <Button
              label={t('totp.doneButton', 'Done')}
              onPress={handleDone}
            />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  body: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  errorBox: {
    backgroundColor: colors.error + '15',
    borderRadius: radii.md,
    padding: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.error,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: spacing[4],
    padding: spacing[4],
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  orText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing[2],
  },
  secretBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing[3],
    alignItems: 'center',
    ...shadows.sm,
  },
  secretText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  copyHint: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.primary[500],
    marginTop: spacing[1],
  },
  inputGroup: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginVertical: spacing[4],
  },
  codeChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    ...shadows.sm,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
});

export default TOTPSetupScreen;
