import { useEffect, useState, useCallback, memo } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, Alert, ScrollView, Linking } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import i18n, { type SupportedLanguage } from '../i18n';
import { getSetting, setSetting, getInvoices, clearSyncedLocalInvoices } from '../services/database';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { getAccessToken } from '../services/authTokens';
import * as authApi from '../services/authApi';
import { useFormValidation, validationRules, showValidationError } from '../utils/validation';
import AnimatedButton from '../components/AnimatedButton';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { colors, spacing, radii, typography } from '../theme/tokens';

const LANGUAGE_KEY = 'language';

interface SettingSection {
  id: string;
  title: string;
  icon: string;
  expanded: boolean;
}

function SettingsScreen() {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { lastSyncAt, manualSync } = useSyncContext();
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [storageStats, setStorageStats] = useState({ total: 0, synced: 0, pending: 0 });
  const [expandedSection, setExpandedSection] = useState<string | null>('language');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [registerUserId, setRegisterUserId] = useState<string | null>(null);
  const [authOtp, setAuthOtp] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const { values, errors, touched, setValue, setTouchedField, validateAll } = useFormValidation(
    { apiUrl: '' },
    { apiUrl: validationRules.apiUrl }
  );

  const loadStorageStats = useCallback(async () => {
    try {
      const invoices = await getInvoices();
      const synced = invoices.filter((inv: any) => inv.synced === 1).length;
      const pending = invoices.filter((inv: any) => inv.synced === 0).length;
      setStorageStats({ total: invoices.length, synced, pending });
    } catch {
      setStorageStats({ total: 0, synced: 0, pending: 0 });
    }
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const token = await getAccessToken();
      setIsAuthenticated(Boolean(token));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    void getSetting(LANGUAGE_KEY)
      .then((v) => {
        if (v === 'pidgin' || v === 'en') {
          setLang(v);
          void i18n.changeLanguage(v);
        }
      })
      .catch(() => undefined);

    void getApiBaseUrl().then(url => {
      setValue('apiUrl', url);
    }).catch(() => undefined);

    loadStorageStats();
    void refreshAuthStatus();
  }, [loadStorageStats, refreshAuthStatus, setValue]);

  const resetAuthForms = useCallback(() => {
    setAuthName('');
    setAuthPhone('');
    setAuthPassword('');
    setRegisterUserId(null);
    setAuthOtp('');
    setMfaToken(null);
    setTotpCode('');
  }, []);

  const handleLogin = useCallback(async () => {
    if (isAuthSubmitting) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to sign in. You can keep creating invoices offline.');
      return;
    }
    if (!authPhone.trim() || authPhone.trim().length < 10) {
      showValidationError('Validation Error', 'Enter a valid phone number');
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      showValidationError('Validation Error', 'Enter your password (min 6 characters)');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const res = await authApi.login(authPhone.trim(), authPassword);
      if ((res as any)?.requiresMfa && (res as any)?.mfaToken) {
        setMfaToken((res as any).mfaToken);
        Alert.alert('MFA Required', 'Enter your authenticator code to finish signing in.');
        return;
      }

      await refreshAuthStatus();
      Alert.alert('Signed in', 'Sync is now enabled on this device.');
      resetAuthForms();
      if (isOnline) {
        void manualSync();
      }
    } catch {
      showValidationError('Sign-in failed', 'Please check your phone number and password and try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authPassword, authPhone, isAuthSubmitting, isOnline, manualSync, refreshAuthStatus, resetAuthForms]);

  const handleMfaVerify = useCallback(async () => {
    if (isAuthSubmitting) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to verify MFA.');
      return;
    }
    if (!mfaToken) {
      showValidationError('Missing step', 'Please start sign-in again.');
      return;
    }
    if (!totpCode.trim() || totpCode.trim().length < 4) {
      showValidationError('Validation Error', 'Enter your authenticator code');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await authApi.mfaLogin(mfaToken, totpCode.trim());
      await refreshAuthStatus();
      Alert.alert('Signed in', 'Sync is now enabled on this device.');
      resetAuthForms();
      if (isOnline) {
        void manualSync();
      }
    } catch {
      showValidationError('MFA failed', 'Please check the code and try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [isAuthSubmitting, isOnline, manualSync, mfaToken, refreshAuthStatus, resetAuthForms, totpCode]);

  const handleRegister = useCallback(async () => {
    if (isAuthSubmitting) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to create an account.');
      return;
    }
    if (!authName.trim() || authName.trim().length < 2) {
      showValidationError('Validation Error', 'Enter your full name');
      return;
    }
    if (!authPhone.trim() || authPhone.trim().length < 10) {
      showValidationError('Validation Error', 'Enter a valid phone number');
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      showValidationError('Validation Error', 'Create a password (min 6 characters)');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const res = await authApi.register(authPhone.trim(), authName.trim(), authPassword);
      setRegisterUserId(res.userId);
      Alert.alert('Verify phone', 'Enter the OTP sent to your phone to finish setup.');
    } catch {
      showValidationError('Signup failed', 'Could not create account. Please try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authName, authPassword, authPhone, isAuthSubmitting, isOnline]);

  const handleVerifyOtp = useCallback(async () => {
    if (isAuthSubmitting) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to verify your phone.');
      return;
    }
    if (!registerUserId) {
      showValidationError('Missing step', 'Please create your account first.');
      return;
    }
    if (!authOtp.trim() || authOtp.trim().length < 4) {
      showValidationError('Validation Error', 'Enter the OTP');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await authApi.verifyPhone(registerUserId, authOtp.trim());
      await refreshAuthStatus();
      Alert.alert('Account ready', 'Your phone is verified and sync is now enabled.');
      resetAuthForms();
      if (isOnline) {
        void manualSync();
      }
    } catch {
      showValidationError('Verification failed', 'Please check the OTP and try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authOtp, isAuthSubmitting, isOnline, manualSync, refreshAuthStatus, registerUserId, resetAuthForms]);

  const handleLogout = useCallback(async () => {
    if (isAuthSubmitting) return;
    setIsAuthSubmitting(true);
    try {
      await authApi.logout();
      await refreshAuthStatus();
      Alert.alert('Signed out', 'This device is now signed out. Offline invoices remain on your phone.');
      resetAuthForms();
    } catch {
      showValidationError('Sign-out failed', 'Please try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [isAuthSubmitting, refreshAuthStatus, resetAuthForms]);

  const choose = async (next: SupportedLanguage) => {
    setLang(next);
    await setSetting(LANGUAGE_KEY, next);
    await i18n.changeLanguage(next);
  };

  const saveApiUrl = async () => {
    if (!validateAll()) {
      showValidationError('Validation Error', 'Please enter a valid API URL');
      return;
    }

    try {
      await setApiBaseUrl(values.apiUrl);
      Alert.alert('Success', 'API URL updated successfully');
    } catch (error) {
      showValidationError('Error', 'Failed to save API URL');
    }
  };

  const handleClearSyncedData = useCallback(() => {
    Alert.alert(
      'Clear Synced Invoices?',
      `This will remove ${storageStats.synced} synced invoices from local storage. They are safely stored on the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await clearSyncedLocalInvoices(0);
              Alert.alert('Success', `Removed ${removed} synced invoices from local storage.`);
              loadStorageStats();
            } catch {
              showValidationError('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  }, [storageStats.synced, loadStorageStats]);

  const handleJoinCommunity = useCallback(() => {
    Alert.alert(
      'Join TaxBridge Community',
      'Connect with 2,000+ Nigerian SMEs sharing tax tips and best practices.',
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.whatsappGroup'), onPress: () => Linking.openURL('https://chat.whatsapp.com/taxbridge') },
        { text: t('settings.discord'), onPress: () => Linking.openURL('https://discord.gg/taxbridge') },
      ]
    );
  }, []);

  const handleExportData = useCallback(() => {
    Alert.alert(
      t('settings.exportTitle'),
      t('settings.exportDesc'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        // { text: t('settings.exportBtn'), onPress: () => Alert.alert(t('common.comingSoon'), t('settings.exportComingSoon')) },
      ]
    );
  }, [t]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  }, []);

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const diff = Date.now() - lastSyncAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Text style={styles.headerIcon}>⚙️</Text>
          <View>
            <Text style={styles.h1}>{t('settings.title')}</Text>
            <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
          </View>
        </Animated.View>

        {/* Network Status Card */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={[styles.statusCard, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{isOnline ? '🟢' : '🔴'}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, !isOnline && styles.statusTitleOffline]}>
                {isOnline ? t('home.onlineSync') : t('home.offlineStatus')}
              </Text>
              <Text style={styles.statusSubtitle}>{t('sync.lastSync')}: {formatLastSync()}</Text>
            </View>
          </View>
          <View style={styles.statusStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{storageStats.total}</Text>
              <Text style={styles.statLabel}>{t('settings.total')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueSuccess]}>{storageStats.synced}</Text>
              <Text style={styles.statLabel}>{t('settings.synced')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueWarning]}>{storageStats.pending}</Text>
              <Text style={styles.statLabel}>{t('settings.pending')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Language & Accessibility Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('language')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🌍</Text>
              <Text style={styles.sectionTitle}>{t('settings.language')} & Accessibility</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'language' ? '▼' : '▶'}</Text>
          </Pressable>
          
          {expandedSection === 'language' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <View style={styles.row}>
                <Pressable 
                  style={[styles.option, lang === 'en' && styles.optionActive]} 
                  onPress={() => void choose('en')}
                >
                  <Text style={styles.optionEmoji}>🇬🇧</Text>
                  <Text style={[styles.optionText, lang === 'en' && styles.optionTextActive]}>
                    {t('settings.english')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.option, lang === 'pidgin' && styles.optionActive]}
                  onPress={() => void choose('pidgin')}
                >
                  <Text style={styles.optionEmoji}>🇳🇬</Text>
                  <Text style={[styles.optionText, lang === 'pidgin' && styles.optionTextActive]}>
                    {t('settings.pidgin')}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                Choose your preferred language for the app interface
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Data & Storage Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(300)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('data')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>💾</Text>
              <Text style={styles.sectionTitle}>Data & Storage</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'data' ? '▼' : '▶'}</Text>
          </Pressable>
          
          {expandedSection === 'data' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              {/* Storage Meter */}
              <View style={styles.storageMeter}>
                <View style={styles.storageHeader}>
                  <Text style={styles.storageLabel}>Local Storage</Text>
                  <Text style={styles.storageValue}>{storageStats.total} invoices</Text>
                </View>
                <View style={styles.storageBar}>
                  <View 
                    style={[
                      styles.storageBarFill, 
                      { width: `${Math.min((storageStats.synced / Math.max(storageStats.total, 1)) * 100, 100)}%` }
                    ]} 
                  />
                </View>
                <View style={styles.storageLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotSuccess]} />
                    <Text style={styles.legendText}>Synced ({storageStats.synced})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotWarning]} />
                    <Text style={styles.legendText}>Pending ({storageStats.pending})</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <Pressable style={styles.actionButton} onPress={handleClearSyncedData}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                  <View>
                    <Text style={styles.actionTitle}>Clear Synced Data</Text>
                    <Text style={styles.actionSubtitle}>Free up local storage</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={handleExportData}>
                  <Text style={styles.actionIcon}>📤</Text>
                  <View>
                    <Text style={styles.actionTitle}>Export Your Data</Text>
                    <Text style={styles.actionSubtitle}>Download invoices as CSV</Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Network & Sync Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(400)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('network')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🔄</Text>
              <Text style={styles.sectionTitle}>Network & Sync</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'network' ? '▼' : '▶'}</Text>
          </Pressable>
          
          {expandedSection === 'network' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <Text style={styles.label}>{t('settings.apiUrl')}</Text>
              <TextInput
                style={[styles.input, errors.apiUrl && touched.apiUrl && styles.inputError]}
                value={values.apiUrl}
                onChangeText={(text) => setValue('apiUrl', text)}
                onBlur={() => setTouchedField('apiUrl')}
                placeholder={t('placeholders.apiUrl')}
                placeholderTextColor={colors.disabled}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.apiUrl && touched.apiUrl && (
                <Text style={styles.errorText}>{errors.apiUrl}</Text>
              )}
              <AnimatedButton
                title={t('settings.save')}
                onPress={saveApiUrl}
                style={styles.saveButton}
              />
            </Animated.View>
          )}
        </Animated.View>

        {/* Account & Sync Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(450)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('account')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>👤</Text>
              <Text style={styles.sectionTitle}>{t('settings.accountSyncTitle')}</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'account' ? '▼' : '▶'}</Text>
          </Pressable>

          {expandedSection === 'account' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <Text style={styles.helperText}>
                {t('settings.accountSyncHelper')}
              </Text>

              {isAuthenticated ? (
                <View style={styles.accountCard}>
                  <View style={styles.accountRow}>
                    <Text style={styles.accountStatusDot}>🟢</Text>
                    <View style={styles.accountStatusInfo}>
                      <Text style={styles.accountStatusTitle}>{t('settings.signedInTitle')}</Text>
                      <Text style={styles.accountStatusSubtitle}>{t('settings.signedInSubtitle')}</Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <AnimatedButton
                      title={t('settings.syncNow')}
                      onPress={() => void manualSync()}
                      loading={isAuthSubmitting}
                      style={{ flex: 1 }}
                    />
                    <AnimatedButton
                      title={t('settings.logout')}
                      onPress={() => void handleLogout()}
                      variant="secondary"
                      loading={isAuthSubmitting}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.option, authMode === 'login' && styles.optionActive]}
                      onPress={() => {
                        setAuthMode('login');
                        setRegisterUserId(null);
                        setMfaToken(null);
                      }}
                    >
                      <Text style={[styles.optionText, authMode === 'login' && styles.optionTextActive]}>{t('settings.signIn')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.option, authMode === 'register' && styles.optionActive]}
                      onPress={() => {
                        setAuthMode('register');
                        setRegisterUserId(null);
                        setMfaToken(null);
                      }}
                    >
                      <Text style={[styles.optionText, authMode === 'register' && styles.optionTextActive]}>{t('settings.createAccount')}</Text>
                    </Pressable>
                  </View>

                  {authMode === 'register' && (
                    <>
                      <Text style={styles.label}>Full name</Text>
                      <TextInput
                        style={styles.input}
                        value={authName}
                        onChangeText={setAuthName}
                        placeholder="e.g. Amina Yusuf"
                        placeholderTextColor={colors.disabled}
                        autoCapitalize="words"
                      />
                    </>
                  )}

                  <Text style={styles.label}>Phone number</Text>
                  <TextInput
                    style={styles.input}
                    value={authPhone}
                    onChangeText={setAuthPhone}
                    placeholder="08012345678"
                    placeholderTextColor={colors.disabled}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.disabled}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  {mfaToken && (
                    <>
                      <Text style={styles.label}>Authenticator code</Text>
                      <TextInput
                        style={styles.input}
                        value={totpCode}
                        onChangeText={setTotpCode}
                        placeholder="123456"
                        placeholderTextColor={colors.disabled}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <AnimatedButton
                        title={t('auth.verifyMfa')}
                        onPress={() => void handleMfaVerify()}
                        loading={isAuthSubmitting}
                      />
                    </>
                  )}

                  {authMode === 'login' && !mfaToken && (
                    <AnimatedButton
                      title={t('auth.signIn')}
                      onPress={() => void handleLogin()}
                      loading={isAuthSubmitting}
                    />
                  )}

                  {authMode === 'register' && !registerUserId && (
                    <AnimatedButton
                      title={t('auth.createAccount')}
                      onPress={() => void handleRegister()}
                      loading={isAuthSubmitting}
                    />
                  )}

                  {authMode === 'register' && registerUserId && (
                    <>
                      <Text style={styles.label}>OTP</Text>
                      <TextInput
                        style={styles.input}
                        value={authOtp}
                        onChangeText={setAuthOtp}
                        placeholder="123456"
                        placeholderTextColor={colors.disabled}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <AnimatedButton
                        title={t('auth.verifyPhone')}
                        onPress={() => void handleVerifyOtp()}
                        loading={isAuthSubmitting}
                      />
                    </>
                  )}
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Community Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(500)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('community')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>👥</Text>
              <Text style={styles.sectionTitle}>Community</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'community' ? '▼' : '▶'}</Text>
          </Pressable>
          
          {expandedSection === 'community' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <Pressable style={styles.communityCard} onPress={handleJoinCommunity}>
                <View style={styles.communityHeader}>
                  <Text style={styles.communityIcon}>🌉</Text>
                  <View>
                    <Text style={styles.communityTitle}>Join 2,000+ SMEs</Text>
                    <Text style={styles.communitySubtitle}>Tax tips, support & networking</Text>
                  </View>
                </View>
                <Text style={styles.communityArrow}>→</Text>
              </Pressable>

              <View style={styles.referralCard}>
                <Text style={styles.referralIcon}>🎁</Text>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralTitle}>Refer & Earn</Text>
                  <Text style={styles.referralText}>
                    Invite 3 traders and earn ₦500 each. They get 1 free tax consultation!
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Security & Compliance Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(600)}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('security')}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🔒</Text>
              <Text style={styles.sectionTitle}>{t('settings.securityComplianceTitle')}</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedSection === 'security' ? '▼' : '▶'}</Text>
          </Pressable>
          
          {expandedSection === 'security' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <View style={styles.complianceCard}>
                <View style={styles.complianceBadge}>
                  <Text style={styles.complianceBadgeIcon}>✓</Text>
                  <Text style={styles.complianceBadgeText}>{t('settings.ndprCompliant')}</Text>
                </View>
                <Text style={styles.complianceText}>
                  {t('settings.ndprText')}
                </Text>
              </View>

              <View style={styles.securityFeatures}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🔐</Text>
                  <Text style={styles.featureText}>{t('settings.localFirstStorage')}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📵</Text>
                  <Text style={styles.featureText}>{t('settings.offlineArchitecture')}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🏛️</Text>
                  <Text style={styles.featureText}>{t('settings.nrsReady')}</Text>
                </View>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={FadeInDown.duration(300).delay(700)} style={styles.appInfo}>
          <Text style={styles.appName}>{t('settings.appName', { version: Constants.expoConfig?.version || '5.0.2' })}</Text>
          <Text style={styles.appTagline}>{t('settings.appTagline')}</Text>
          <Text style={styles.copyright}>{t('settings.copyright')}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default memo(SettingsScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  headerIcon: {
    fontSize: 32,
  },
  h1: { fontSize: 26, fontWeight: '900', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  
  // Status Card
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  statusOffline: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 18,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.successDark,
  },
  statusTitleOffline: {
    color: colors.warningDark,
  },
  statusSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderTransparent,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statValueSuccess: {
    color: colors.success,
  },
  statValueWarning: {
    color: colors.warning,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  
  // Language Options
  row: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceSlate,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    gap: 8,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  optionTextActive: { color: colors.primary },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },

  // Account
  accountCard: {
    backgroundColor: colors.successBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginTop: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  accountStatusDot: {
    fontSize: 16,
  },
  accountStatusInfo: {
    flex: 1,
  },
  accountStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.successDark,
  },
  accountStatusSubtitle: {
    fontSize: 12,
    color: colors.successDark,
    marginTop: 2,
  },
  
  // Storage
  storageMeter: {
    marginBottom: 16,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  storageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  storageValue: {
    fontSize: 14,
    color: colors.textMuted,
  },
  storageBar: {
    height: 8,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radii.sm,
  },
  storageLegend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  legendDotSuccess: {
    backgroundColor: colors.success,
  },
  legendDotWarning: {
    backgroundColor: colors.warning,
  },
  legendText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  
  // Action Buttons
  actionButtons: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSlate,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  
  // Form
  label: { color: colors.textSecondary, marginBottom: 8, fontWeight: '700', fontSize: 14 },
  input: {
    backgroundColor: colors.surfaceSlate,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBgSubtle,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 8,
  },
  
  // Community
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  communityIcon: {
    fontSize: 28,
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.infoDark,
  },
  communitySubtitle: {
    fontSize: 12,
    color: colors.info,
    marginTop: 2,
  },
  communityArrow: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  referralIcon: {
    fontSize: 24,
  },
  referralInfo: {
    flex: 1,
  },
  referralTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warningDark,
    marginBottom: 4,
  },
  referralText: {
    fontSize: 13,
    color: colors.warningDark,
    lineHeight: 18,
  },
  
  // Compliance
  complianceCard: {
    backgroundColor: colors.successBg,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  complianceBadgeIcon: {
    fontSize: 14,
    color: colors.success,
  },
  complianceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.successDark,
  },
  complianceText: {
    fontSize: 13,
    color: colors.successDark,
    lineHeight: 18,
  },
  securityFeatures: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceSlate,
    padding: 12,
    borderRadius: 10,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appTagline: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  copyright: {
    fontSize: 11,
    color: colors.disabled,
    marginTop: 8,
  },
});
