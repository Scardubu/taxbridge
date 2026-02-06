import { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { 
  Pressable, 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View, 
  Alert, 
  ScrollView, 
  Linking,
  Platform,
  InteractionManager,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import i18n, { type SupportedLanguage } from '../i18n';
import { getSetting, setSetting, getInvoices, clearSyncedLocalInvoices } from '../services/database';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { getAccessToken } from '../services/authTokens';
import * as authApi from '../services/authApi';
import { useFormValidation, validationRules, showValidationError } from '../utils/validation';
import AnimatedButton from '../components/AnimatedButton';
import { showToast } from '../components/ui/Toast';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { colors, spacing, radii, typography } from '../theme/tokens';

// ============================================================================
// Constants
// ============================================================================

const LANGUAGE_KEY = 'language';

const VALIDATION_LIMITS = {
  PHONE_MIN_LENGTH: 10,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  OTP_LENGTH: 4,
} as const;

// ============================================================================
// Types
// ============================================================================

interface StorageStats {
  total: number;
  synced: number;
  pending: number;
}

interface Invoice {
  id: string;
  synced: 0 | 1;
  items: string;
  createdAt: number;
}

interface InvoiceItem {
  quantity: number;
  unitPrice: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

const parseInvoiceItems = (itemsJson: string): InvoiceItem[] => {
  try {
    const items = JSON.parse(itemsJson);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

// formatLastSync moved inside component to access t() for i18n

// ============================================================================
// Section Components
// ============================================================================

interface SectionHeaderProps {
  icon: string;
  title: string;
  expanded: boolean;
  onPress: () => void;
}

const SectionHeader = memo(({ icon, title, expanded, onPress }: SectionHeaderProps) => (
  <Pressable 
    style={styles.sectionHeader} 
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    accessible={true}
    accessibilityRole="button"
    accessibilityState={{ expanded }}
    accessibilityLabel={`${title} section`}
  >
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text 
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
    <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
  </Pressable>
));

SectionHeader.displayName = 'SectionHeader';

// ============================================================================
// Storage Meter Component
// ============================================================================

interface StorageMeterProps {
  stats: StorageStats;
}

const StorageMeter = memo(({ stats }: StorageMeterProps) => {
  const { t } = useTranslation();
  
  const fillPercentage = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.min((stats.synced / stats.total) * 100, 100);
  }, [stats.total, stats.synced]);

  return (
    <View style={styles.storageMeter}>
      <View style={styles.storageHeader}>
        <Text style={styles.storageLabel}>{t('settings.storageTitle')}</Text>
        <Text style={styles.storageValue}>{t('settings.storageInvoices', { count: stats.total })}</Text>
      </View>
      <View style={styles.storageBar}>
        <View 
          style={[styles.storageBarFill, { width: `${fillPercentage}%` }]} 
        />
      </View>
      <View style={styles.storageLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotSuccess]} />
          <Text style={styles.legendText}>{t('settings.storageSynced', { count: stats.synced })}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotWarning]} />
          <Text style={styles.legendText}>{t('settings.storagePending', { count: stats.pending })}</Text>
        </View>
      </View>
    </View>
  );
});

StorageMeter.displayName = 'StorageMeter';

// ============================================================================
// Main Component
// ============================================================================

function SettingsScreen() {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { lastSyncAt, manualSync } = useSyncContext();

  // State
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [storageStats, setStorageStats] = useState<StorageStats>({ total: 0, synced: 0, pending: 0 });
  const [expandedSection, setExpandedSection] = useState<string | null>('language');
  const [isExporting, setIsExporting] = useState(false);

  // Auth state
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

  // Form validation
  const { values, errors, touched, setValue, setTouchedField, validateAll } = useFormValidation(
    { apiUrl: '' },
    { apiUrl: validationRules.apiUrl }
  );

  // Refs
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // ============================================================================
  // Utility Functions (inside component for i18n access)
  // ============================================================================

  const formatLastSync = useCallback((timestamp: number | null): string => {
    if (!timestamp) return t('sync.neverSynced');
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
    if (hours < 24) return t('sync.hoursAgo', { count: hours });
    
    return new Date(timestamp).toLocaleDateString();
  }, [t]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadStorageStats = useCallback(async () => {
    try {
      const invoices = (await getInvoices()).map(inv => ({ ...inv, createdAt: new Date(inv.createdAt).getTime() })) as Invoice[];
      const synced = invoices.filter(inv => inv.synced === 1).length;
      const pending = invoices.filter(inv => inv.synced === 0).length;
      setStorageStats({ total: invoices.length, synced, pending });
    } catch (error) {
      if (__DEV__) console.error('Failed to load storage stats:', error);
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
    // Load language preference
    getSetting(LANGUAGE_KEY)
      .then((v) => {
        if (v === 'pidgin' || v === 'en') {
          setLang(v);
          void i18n.changeLanguage(v);
        }
      })
      .catch(() => undefined);

    // Load API URL
    getApiBaseUrl()
      .then(url => setValue('apiUrl', url))
      .catch(() => undefined);

    const task = InteractionManager.runAfterInteractions(() => {
      loadStorageStats();
      void refreshAuthStatus();
    });

    return () => task.cancel();
  }, [loadStorageStats, refreshAuthStatus, setValue]);

  // Auto-focus on validation errors
  useEffect(() => {
    if (errors.phone && touched.phone) {
      phoneInputRef.current?.focus();
    } else if (errors.password && touched.password) {
      passwordInputRef.current?.focus();
    }
  }, [errors.phone, errors.password, touched.phone, touched.password]);

  // ============================================================================
  // Auth Handlers
  // ============================================================================

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
      showToast({
        type: 'warning',
        message: t('settings.offlineSignInMsg'),
        haptic: 'warning'
      });
      return;
    }
    
    if (!authPhone.trim() || authPhone.trim().length < VALIDATION_LIMITS.PHONE_MIN_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterValidPhone'));
      return;
    }
    
    if (!authPassword || authPassword.length < VALIDATION_LIMITS.PASSWORD_MIN_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterPassword', { count: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH }));
      return;
    }

    setIsAuthSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const res = await authApi.login(authPhone.trim(), authPassword);
      
      if ((res as any)?.requiresMfa && (res as any)?.mfaToken) {
        setMfaToken((res as any).mfaToken);
        showToast({
          type: 'info',
          message: t('settings.mfaRequiredMsg')
        });
        return;
      }

      await refreshAuthStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('settings.signedIn'), t('settings.signedInMsg'));
      resetAuthForms();
      
      if (isOnline) {
        void manualSync();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.signInFailed'), t('settings.signInFailedMsg'));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authPassword, authPhone, isAuthSubmitting, isOnline, manualSync, refreshAuthStatus, resetAuthForms]);

  const handleMfaVerify = useCallback(async () => {
    if (isAuthSubmitting || !isOnline || !mfaToken) return;
    
    if (!totpCode.trim() || totpCode.trim().length < VALIDATION_LIMITS.OTP_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterAuthCode'));
      return;
    }

    setIsAuthSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await authApi.mfaLogin(mfaToken, totpCode.trim());
      await refreshAuthStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        type: 'success',
        message: t('settings.signedInMsg'),
        haptic: 'success'
      });
      resetAuthForms();
      
      if (isOnline) {
        void manualSync();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.mfaFailed'), t('settings.mfaFailedMsg'));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [isAuthSubmitting, isOnline, manualSync, mfaToken, refreshAuthStatus, resetAuthForms, totpCode]);

  const handleRegister = useCallback(async () => {
    if (isAuthSubmitting || !isOnline) return;
    
    if (!authName.trim() || authName.trim().length < VALIDATION_LIMITS.NAME_MIN_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterFullName'));
      return;
    }
    
    if (!authPhone.trim() || authPhone.trim().length < VALIDATION_LIMITS.PHONE_MIN_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterValidPhone'));
      return;
    }
    
    if (!authPassword || authPassword.length < VALIDATION_LIMITS.PASSWORD_MIN_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.createPassword', { count: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH }));
      return;
    }

    setIsAuthSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const res = await authApi.register(authPhone.trim(), authName.trim(), authPassword);
      setRegisterUserId(res.userId);
      showToast({
        type: 'info',
        message: t('settings.verifyPhoneMsg')
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.signupFailed'), t('settings.signupFailedMsg'));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authName, authPassword, authPhone, isAuthSubmitting, isOnline]);

  const handleVerifyOtp = useCallback(async () => {
    if (isAuthSubmitting || !isOnline || !registerUserId) return;
    
    if (!authOtp.trim() || authOtp.trim().length < VALIDATION_LIMITS.OTP_LENGTH) {
      showValidationError(t('settings.validationError'), t('settings.enterOtp'));
      return;
    }

    setIsAuthSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await authApi.verifyPhone(registerUserId, authOtp.trim());
      await refreshAuthStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        type: 'success',
        message: t('settings.accountReadyMsg'),
        haptic: 'success'
      });
      resetAuthForms();
      
      if (isOnline) {
        void manualSync();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.verificationFailed'), t('settings.verificationFailedMsg'));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [authOtp, isAuthSubmitting, isOnline, manualSync, refreshAuthStatus, registerUserId, resetAuthForms]);

  const handleLogout = useCallback(async () => {
    if (isAuthSubmitting) return;
    
    setIsAuthSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await authApi.logout();
      await refreshAuthStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        type: 'info',
        message: t('settings.signedOutMsg')
      });
      resetAuthForms();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.signOutFailed'), t('settings.signOutFailedMsg'));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [isAuthSubmitting, refreshAuthStatus, resetAuthForms]);

  // ============================================================================
  // Settings Handlers
  // ============================================================================

  const chooseLanguage = useCallback(async (next: SupportedLanguage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLang(next);
    await setSetting(LANGUAGE_KEY, next);
    await i18n.changeLanguage(next);
  }, []);

  const saveApiUrl = useCallback(async () => {
    if (!validateAll()) {
      showValidationError(t('settings.validationError'), t('settings.enterValidApiUrl'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await setApiBaseUrl(values.apiUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        type: 'success',
        message: t('settings.apiUrlUpdated'),
        haptic: 'success'
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('settings.error'), t('settings.failedSaveApiUrl'));
    }
  }, [validateAll, values.apiUrl]);

  const handleClearSyncedData = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      t('settings.clearSyncedTitle'),
      t('settings.clearSyncedMsg', { count: storageStats.synced }),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await clearSyncedLocalInvoices(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast({
                type: 'success',
                message: t('settings.removedSyncedMsg', { count: removed }),
                haptic: 'success'
              });
              loadStorageStats();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showValidationError(t('settings.error'), t('settings.failedClearData'));
            }
          },
        },
      ]
    );
  }, [storageStats.synced, loadStorageStats]);

  const handleExportData = useCallback(async () => {
    if (isExporting) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);
    
    try {
      const invoices = (await getInvoices()).map(inv => ({ ...inv, createdAt: new Date(inv.createdAt).getTime() })) as Invoice[];
      
      // Generate CSV
      const headers = 'Date,Amount,Status\n';
      const rows = invoices.map(inv => {
        const items = parseInvoiceItems(inv.items);
        const total = items.reduce((s, item) => s + (item.quantity * item.unitPrice), 0);
        const date = new Date(inv.createdAt).toLocaleDateString();
        const status = inv.synced ? 'Synced' : 'Pending';
        return `${date},${total},${status}`;
      }).join('\n');
      
      const csv = headers + rows;
      
      // Save to file
      const fileName = `taxbridge_invoices_${Date.now()}.csv`;
      const fileUri = `${(FileSystem as any).documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: t('settings.exportInvoices'),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showToast({
          type: 'success',
          message: t('settings.exportCompleteMsg', { path: fileUri }),
          haptic: 'success',
          duration: 5000
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Export failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('error'), t('settings.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, t]);

  const handleJoinCommunity = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      t('settings.joinCommunityTitle'),
      t('settings.joinCommunityDesc'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { 
          text: t('settings.whatsappGroup'), 
          onPress: () => Linking.openURL('https://chat.whatsapp.com/taxbridge') 
        },
        { 
          text: t('settings.discord'), 
          onPress: () => Linking.openURL('https://discord.gg/taxbridge') 
        },
      ]
    );
  }, [t]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        accessible={true}
        accessibilityLabel={t('settings.mainContent')}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Text style={styles.headerIcon}>⚙️</Text>
          <View>
            <Text style={styles.h1}>{t('settings.title')}</Text>
            <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
          </View>
        </Animated.View>

        {/* Network Status Card */}
        <Animated.View 
          entering={FadeInDown.duration(300).delay(100)} 
          style={[styles.statusCard, isOnline ? styles.statusOnline : styles.statusOffline]}
        >
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{isOnline ? '🟢' : '🔴'}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, !isOnline && styles.statusTitleOffline]}>
                {isOnline ? t('home.onlineSync') : t('home.offlineStatus')}
              </Text>
              <Text style={styles.statusSubtitle}>
                {t('sync.lastSync')}: {formatLastSync(lastSyncAt)}
              </Text>
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
          <SectionHeader
            icon="🌍"
            title={t('settings.languageAndAccessibility')}
            expanded={expandedSection === 'language'}
            onPress={() => toggleSection('language')}
          />
          
          {expandedSection === 'language' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <View style={styles.row}>
                <Pressable 
                  style={[styles.option, lang === 'en' && styles.optionActive]} 
                  onPress={() => void chooseLanguage('en')}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: lang === 'en' }}
                >
                  <Text style={styles.optionEmoji}>🇬🇧</Text>
                  <Text style={[styles.optionText, lang === 'en' && styles.optionTextActive]}>
                    {t('settings.english')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.option, lang === 'pidgin' && styles.optionActive]}
                  onPress={() => void chooseLanguage('pidgin')}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: lang === 'pidgin' }}
                >
                  <Text style={styles.optionEmoji}>🇳🇬</Text>
                  <Text style={[styles.optionText, lang === 'pidgin' && styles.optionTextActive]}>
                    {t('settings.pidgin')}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                {t('settings.languageHelperText')}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Data & Storage Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(300)}>
          <SectionHeader
            icon="💾"
            title={t('settings.dataAndStorage')}
            expanded={expandedSection === 'data'}
            onPress={() => toggleSection('data')}
          />
          
          {expandedSection === 'data' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <StorageMeter stats={storageStats} />

              <View style={styles.actionButtons}>
                <Pressable 
                  style={styles.actionButton} 
                  onPress={handleClearSyncedData}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.clearSyncedDataA11y')}
                >
                  <Text style={styles.actionIcon}>🗑️</Text>
                  <View>
                    <Text style={styles.actionTitle}>{t('settings.clearSyncedDataTitle')}</Text>
                    <Text style={styles.actionSubtitle}>{t('settings.clearSyncedDataSubtitle')}</Text>
                  </View>
                </Pressable>
                <Pressable 
                  style={styles.actionButton} 
                  onPress={handleExportData}
                  disabled={isExporting}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.exportA11y')}
                >
                  <Text style={styles.actionIcon}>📤</Text>
                  <View>
                    <Text style={styles.actionTitle}>
                      {isExporting ? t('settings.exporting') : t('settings.exportYourData')}
                    </Text>
                    <Text style={styles.actionSubtitle}>{t('settings.exportSubtitle')}</Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Network & Sync Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(400)}>
          <SectionHeader
            icon="🔄"
            title={t('settings.networkAndSync')}
            expanded={expandedSection === 'network'}
            onPress={() => toggleSection('network')}
          />
          
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
                accessible={true}
                accessibilityLabel={t('settings.apiUrlA11y')}
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
          <SectionHeader
            icon="👤"
            title={t('settings.accountSyncTitle')}
            expanded={expandedSection === 'account'}
            onPress={() => toggleSection('account')}
          />

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
                      style={styles.rowButton}
                    />
                    <AnimatedButton
                      title={t('settings.logout')}
                      onPress={() => void handleLogout()}
                      variant="secondary"
                      loading={isAuthSubmitting}
                      style={styles.rowButton}
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
                      accessible={true}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: authMode === 'login' }}
                    >
                      <Text style={[styles.optionText, authMode === 'login' && styles.optionTextActive]}>
                        {t('settings.signIn')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.option, authMode === 'register' && styles.optionActive]}
                      onPress={() => {
                        setAuthMode('register');
                        setRegisterUserId(null);
                        setMfaToken(null);
                      }}
                      accessible={true}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: authMode === 'register' }}
                    >
                      <Text style={[styles.optionText, authMode === 'register' && styles.optionTextActive]}>
                        {t('settings.createAccount')}
                      </Text>
                    </Pressable>
                  </View>

                  {authMode === 'register' && (
                    <>
                      <Text style={styles.label}>{t('auth.fullNameLabel')}</Text>
                      <TextInput
                        style={styles.input}
                        value={authName}
                        onChangeText={setAuthName}
                        placeholder={t('auth.fullNamePlaceholder')}
                        placeholderTextColor={colors.disabled}
                        autoCapitalize="words"
                        accessible={true}
                        accessibilityLabel={t('auth.fullNameLabel')}
                      />
                    </>
                  )}

                  <Text style={styles.label}>{t('auth.phoneLabel')}</Text>
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.input}
                    value={authPhone}
                    onChangeText={setAuthPhone}
                    placeholder={t('auth.phonePlaceholder')}
                    placeholderTextColor={colors.disabled}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessible={true}
                    accessibilityLabel={t('auth.phoneLabel')}
                  />

                  <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={colors.disabled}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessible={true}
                    accessibilityLabel={t('auth.passwordLabel')}
                  />

                  {mfaToken && (
                    <>
                      <Text style={styles.label}>{t('auth.authenticatorCodeLabel')}</Text>
                      <TextInput
                        style={styles.input}
                        value={totpCode}
                        onChangeText={setTotpCode}
                        placeholder={t('auth.otpPlaceholder')}
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
                      <Text style={styles.label}>{t('auth.otpLabel')}</Text>
                      <TextInput
                        style={styles.input}
                        value={authOtp}
                        onChangeText={setAuthOtp}
                        placeholder={t('auth.otpPlaceholder')}
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
          <SectionHeader
            icon="👥"
            title={t('settings.communityTitle')}
            expanded={expandedSection === 'community'}
            onPress={() => toggleSection('community')}
          />
          
          {expandedSection === 'community' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
              <Pressable style={styles.communityCard} onPress={handleJoinCommunity}>
                <View style={styles.communityHeader}>
                  <Text style={styles.communityIcon}>🌉</Text>
                  <View>
                    <Text style={styles.communityTitle}>{t('settings.joinSMEs')}</Text>
                    <Text style={styles.communitySubtitle}>{t('settings.communitySubtitle')}</Text>
                  </View>
                </View>
                <Text style={styles.communityArrow}>→</Text>
              </Pressable>

              <View style={styles.referralCard}>
                <Text style={styles.referralIcon}>🎁</Text>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralTitle}>{t('settings.referEarnTitle')}</Text>
                  <Text style={styles.referralText}>
                    {t('settings.referEarnDesc')}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Security & Compliance Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(600)}>
          <SectionHeader
            icon="🔒"
            title={t('settings.securityComplianceTitle')}
            expanded={expandedSection === 'security'}
            onPress={() => toggleSection('security')}
          />
          
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
          <Text style={styles.appName}>
            {t('settings.appName', { version: Constants.expoConfig?.version || '5.0.2' })}
          </Text>
          <Text style={styles.appTagline}>{t('settings.appTagline')}</Text>
          <Text style={styles.copyright}>{t('settings.copyright')}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default memo(SettingsScreen);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  scroll: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.lg },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerIcon: {
    fontSize: typography.size.xxxl,
  },
  h1: { fontSize: typography.size.xxl, fontWeight: typography.weight.black, color: colors.textPrimary },
  subtitle: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: spacing.xxs },
  
  // Status Card
  statusCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statusIcon: {
    fontSize: typography.size.lg,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.successDark,
  },
  statusTitleOffline: {
    color: colors.warningDark,
  },
  statusSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  statusStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderTransparent,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
  },
  statValueSuccess: {
    color: colors.success,
  },
  statValueWarning: {
    color: colors.warning,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
    marginTop: spacing.xxs,
  },
  
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
  },
  sectionIcon: {
    fontSize: typography.size.lg,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  expandIcon: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  
  // Language Options
  row: { flexDirection: 'row', gap: spacing.md },
  rowButton: {
    flex: 1,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSlate,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionEmoji: {
    fontSize: typography.size.xl,
  },
  optionText: { color: colors.textSecondary, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  optionTextActive: { color: colors.primary },
  helperText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Account
  accountCard: {
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginTop: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    marginBottom: spacing.md,
  },
  accountStatusDot: {
    fontSize: typography.size.md,
  },
  accountStatusInfo: {
    flex: 1,
  },
  accountStatusTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extrabold,
    color: colors.successDark,
  },
  accountStatusSubtitle: {
    fontSize: typography.size.xs,
    color: colors.successDark,
    marginTop: spacing.xxs,
  },
  
  // Storage
  storageMeter: {
    marginBottom: spacing.lg,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  storageLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  storageValue: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  storageBar: {
    height: spacing.sm,
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
    width: spacing.sm,
    height: spacing.sm,
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
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSlate,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionIcon: {
    fontSize: typography.size.xl,
  },
  actionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  
  // Form
  label: { color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  input: {
    backgroundColor: colors.surfaceSlate,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.size.md,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBgSubtle,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.xs,
    marginBottom: spacing.sm,
    fontWeight: typography.weight.medium,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  
  // Community
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  communityIcon: {
    fontSize: typography.size.xxl + spacing.xxs,
  },
  communityTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.infoDark,
  },
  communitySubtitle: {
    fontSize: typography.size.xs,
    color: colors.info,
    marginTop: spacing.xxs,
  },
  communityArrow: {
    fontSize: typography.size.lg,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  referralIcon: {
    fontSize: typography.size.xl + spacing.xs,
  },
  referralInfo: {
    flex: 1,
  },
  referralTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.warningDark,
    marginBottom: spacing.xs,
  },
  referralText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.warningDark,
    lineHeight: spacing.lg + spacing.xxs,
  },
  
  // Compliance
  complianceCard: {
    backgroundColor: colors.successBg,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xxs,
    marginBottom: spacing.sm + spacing.xxs,
  },
  complianceBadgeIcon: {
    fontSize: typography.size.sm,
    color: colors.success,
  },
  complianceBadgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.successDark,
  },
  complianceText: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.successDark,
    lineHeight: spacing.lg + spacing.xxs,
  },
  securityFeatures: {
    gap: spacing.sm + spacing.xxs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    backgroundColor: colors.surfaceSlate,
    padding: spacing.md,
    borderRadius: radii.sm + spacing.xxs,
  },
  featureIcon: {
    fontSize: typography.size.md,
  },
  featureText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  appName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  appTagline: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  copyright: {
    fontSize: typography.size.xs,
    color: colors.disabled,
    marginTop: spacing.sm,
  },
});