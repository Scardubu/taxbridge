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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore, useCurrentUser } from '../../store/authStore';
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

// ── API helpers (keep thin — logic lives in backend) ──────────────────────────

async function requestSetup(token: string): Promise<TOTPSetupResponse> {
  const res = await fetch('/api/v1/auth/totp/setup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Setup failed: ${res.status}`);
  return res.json();
}

async function verifyToken(
  token: string,
  totpCode: string,
): Promise<TOTPVerifyResponse> {
  const res = await fetch('/api/v1/auth/totp/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: totpCode }),
  });
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`);
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TOTPSetupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const { token } = useAuthStore();

  const [step, setStep] = useState<SetupStep>('init');
  const [setup, setSetup] = useState<TOTPSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Step 1: Request TOTP secret ──────────────────────────────────────
  const handleStartSetup = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await requestSetup(token);
      setSetup(data);
      setStep('scan');
    } catch (err: any) {
      setError(err.message ?? t('common.unknownError', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  // ── Step 2: Verify TOTP code ─────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (!token || code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verifyToken(token, code);
      setBackupCodes(data.backupCodes);
      setStep('backup');
    } catch (err: any) {
      setError(err.message ?? t('common.unknownError', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [token, code, t]);

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
  const handleDone = useCallback(() => {
    router.back();
  }, []);

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
                title={t('totp.verifyButton', 'Verify & Activate')}
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
              title={t('totp.copyBackup', 'Copy All Codes')}
              onPress={handleCopyBackupCodes}
              variant="outline"
            />

            <View style={{ height: spacing[4] }} />

            <Button
              title={t('totp.doneButton', 'Done')}
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
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing[1],
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  body: {
    ...typography.body,
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
    ...typography.bodySmall,
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
    ...typography.bodySmall,
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
    color: colors.text,
  },
  copyHint: {
    ...typography.caption,
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
    color: colors.text,
    letterSpacing: 1,
  },
});

export default TOTPSetupScreen;
