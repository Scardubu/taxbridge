import { useMemo, useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown, FadeInRight, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from '../utils/safeHaptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VAT_RATE } from '@taxbridge/contracts';

import type { InvoiceItem } from '../types/invoice';
import { saveInvoice } from '../services/database';
import { trackEvent, trackInvoiceCreated } from '../services/analytics';
import { useFormValidation, validationRules, showValidationError } from '../utils/validation';
import AnimatedButton from '../components/AnimatedButton';
import { showToast } from '../components/ui/Toast';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { TaxIntelligencePanel } from '../components/tax/TaxIntelligencePanel';
import { useLoading } from '../contexts/LoadingContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { useNetwork } from '../contexts/NetworkContext';
import { generateUuid } from '../utils/uuid';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import InvoiceWizard from '../components/wizards/InvoiceWizard';
import { extractReceiptData, type OCRResult } from '../services/ocr';
import { ExtractedDataReview, type EditedData } from '../components/ocr/ExtractedDataReview';
import { ScanErrorModal, type ScanErrorType } from '../components/ocr/ScanErrorModal';
import { getApiBaseUrl } from '../services/config';
import { enqueueSyncQueueItem } from '../services/syncQueue';

// Lazy load heavy components
const CameraModal = lazy(() => import('../components/CameraModal'));

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Constants
// ============================================================================

const INVOICE_CONSTANTS = {
  VAT_RATE,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 99999,
  MIN_UNIT_PRICE: 0,
  MAX_UNIT_PRICE: 99999999,
  OCR_MIN_CONFIDENCE: 0.7,
  AUTO_SAVE_DELAY_MS: 2000,
  DRAFT_KEY: 'invoice_draft',
  MAX_ITEMS: 100,
} as const;

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'customer' | 'items' | 'review';
type CameraFacing = 'front' | 'back';

interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
}

interface InvoiceDraft {
  customerName: string;
  items: InvoiceItem[];
  timestamp: number;
}

interface StepInfo {
  key: WizardStep;
  label: string;
  icon: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

const createLocalId = (): string => generateUuid();

const calculateTotals = (items: InvoiceItem[]): InvoiceTotals => {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vat = subtotal * INVOICE_CONSTANTS.VAT_RATE;
  const total = subtotal + vat;
  return { subtotal, vat, total };
};

const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// ============================================================================
// Step Indicator Component
// ============================================================================

interface StepIndicatorProps {
  steps: StepInfo[];
  currentStep: WizardStep;
  onStepPress: (step: WizardStep) => void;
}

const StepIndicator = memo(({ steps, currentStep, onStepPress }: StepIndicatorProps) => {
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepIndicatorContainer}>
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.stepItem}>
            <Pressable
              onPress={() => {
                if (index < currentStepIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStepPress(step.key);
                }
              }}
              style={[
                styles.stepCircle,
                index <= currentStepIndex && styles.stepCircleActive,
                index < currentStepIndex && styles.stepCircleComplete,
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}: ${step.label}`}
              accessibilityState={{ 
                selected: index === currentStepIndex,
                disabled: index > currentStepIndex,
              }}
            >
              <Text style={[
                styles.stepIcon,
                index <= currentStepIndex && styles.stepIconActive,
              ]}>
                {index < currentStepIndex ? '✓' : step.icon}
              </Text>
            </Pressable>
            <Text style={[
              styles.stepLabel,
              index === currentStepIndex && styles.stepLabelActive,
            ]}>
              {step.label}
            </Text>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepConnector,
                index < currentStepIndex && styles.stepConnectorActive,
              ]} />
            )}
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

StepIndicator.displayName = 'StepIndicator';

// ============================================================================
// Item Card Component
// ============================================================================

interface ItemCardProps {
  item: InvoiceItem;
  index: number;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
}

const ItemCard = memo(({ item, index, onRemove, onEdit }: ItemCardProps) => {
  const { t } = useTranslation();

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).duration(200)}
      style={styles.itemCard}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.description}</Text>
        <Text style={styles.itemDetails}>
          {item.quantity} × ₦{item.unitPrice.toFixed(2)}
        </Text>
      </View>
      <View style={styles.itemActions}>
        <Text style={styles.itemTotal}>₦{(item.quantity * item.unitPrice).toFixed(2)}</Text>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEdit(index);
          }} 
          style={styles.editButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.description}`}
        >
          <Text style={styles.editButtonText}>✎</Text>
        </Pressable>
        <Pressable 
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onRemove(index);
          }} 
          style={styles.removeButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.description}`}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

ItemCard.displayName = 'ItemCard';

// ============================================================================
// Totals Summary Component
// ============================================================================

interface TotalsSummaryProps {
  totals: InvoiceTotals;
  variant?: 'compact' | 'detailed';
}

const TotalsSummary = memo(({ totals, variant = 'compact' }: TotalsSummaryProps) => {
  const { t } = useTranslation();

  if (variant === 'compact') {
    return (
      <View style={styles.stickySummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('create.subtotal')}</Text>
          <Text style={styles.summaryValue}>₦{totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('create.vatLabel')}</Text>
          <Text style={styles.summaryValue}>₦{totals.vat.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.summaryTotalLabel}>{t('create.total')}</Text>
          <Text style={styles.summaryTotalValue}>₦{totals.total.toFixed(2)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.reviewCard, styles.totalsCard]}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewIcon}>💰</Text>
        <Text style={styles.reviewTitle}>{t('create.invoiceTotal')}</Text>
      </View>
      <View style={styles.totalBreakdown}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('create.subtotal')}</Text>
          <Text style={styles.totalValue}>₦{totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('create.vatLabel')}</Text>
          <Text style={styles.totalValue}>₦{totals.vat.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>{t('create.grandTotal')}</Text>
          <Text style={styles.grandTotalValue}>₦{totals.total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
});

TotalsSummary.displayName = 'TotalsSummary';

// ============================================================================
// Main Component
// ============================================================================

function CreateInvoiceScreen(props: any) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { setLoading, setLoadingMessage } = useLoading();
  const { isOnline } = useNetwork();
  const receiptsScannerEnabled = useFeatureFlag('receiptsScanner');
  const offlineInvoicesEnabled = useFeatureFlag('offlineInvoices');

  // Refs
  const customerNameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);
  const unitPriceRef = useRef<TextInput>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const draftSaveTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('customer');
  const stepProgress = useSharedValue(0);
  const [shouldOpenScan, setShouldOpenScan] = useState(false);

  // Handle openScan parameter from navigation
  useEffect(() => {
    if (props?.route?.params?.openScan === true && receiptsScannerEnabled) {
      setShouldOpenScan(true);
    }
  }, [props?.route?.params?.openScan, receiptsScannerEnabled]);

  const steps: StepInfo[] = useMemo(() => [
    { key: 'customer', label: t('create.stepCustomer'), icon: '👤' },
    { key: 'items', label: t('create.stepItems'), icon: '📦' },
    { key: 'review', label: t('create.stepReview'), icon: '✅' },
  ], [t]);

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  useEffect(() => {
    stepProgress.value = withSpring(currentStepIndex / (steps.length - 1));
  }, [currentStep, currentStepIndex, stepProgress, steps.length]);

  // Form state
  const { values, errors, touched, setValue, setTouchedField, validateAll, validateFields, resetForm } = useFormValidation(
    {
      customerName: '',
      customerTIN: '',
      description: '',
      quantity: '1',
      unitPrice: '',
    },
    {
      customerName: validationRules.customerName,
      customerTIN: validationRules.customerTIN,
      description: validationRules.description,
      quantity: validationRules.quantity,
      unitPrice: validationRules.unitPrice,
    }
  );

  // Items state
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Camera state (only when receipt scanner enabled)
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('back');
  const [ocrLoading, setOcrLoading] = useState(false);
  
  // OCR data and modals
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showOcrReview, setShowOcrReview] = useState(false);
  const [ocrError, setOcrError] = useState<ScanErrorType | null>(null);
  const [showOcrError, setShowOcrError] = useState(false);

  // Memoized totals calculation
  const totals = useMemo(() => calculateTotals(items), [items]);

  // ============================================================================
  // Auto-save Draft
  // ============================================================================

  const saveDraft = useCallback(async () => {
    if (draftSaveTaskRef.current) {
      draftSaveTaskRef.current.cancel();
    }

    const draft: InvoiceDraft = {
      customerName: values.customerName,
      items,
      timestamp: Date.now(),
    };

    draftSaveTaskRef.current = InteractionManager.runAfterInteractions(() => {
      AsyncStorage.setItem(INVOICE_CONSTANTS.DRAFT_KEY, JSON.stringify(draft)).catch((error) => {
        if (__DEV__) console.error('Failed to save draft:', error);
      });
    });
  }, [values.customerName, items]);

  const debouncedSaveDraft = useMemo(
    () => debounce(saveDraft, INVOICE_CONSTANTS.AUTO_SAVE_DELAY_MS),
    [saveDraft]
  );

  useEffect(() => {
    if (values.customerName || items.length > 0) {
      debouncedSaveDraft();
    }
  }, [values.customerName, items, debouncedSaveDraft]);

  useEffect(() => {
    return () => {
      draftSaveTaskRef.current?.cancel();
    };
  }, []);

  const loadDraft = useCallback(async () => {
    try {
      const draftStr = await AsyncStorage.getItem(INVOICE_CONSTANTS.DRAFT_KEY);
      if (draftStr) {
        const draft: InvoiceDraft = JSON.parse(draftStr);
        
        // Only restore if recent (within 24 hours)
        const isRecent = Date.now() - draft.timestamp < 24 * 60 * 60 * 1000;
        if (!isRecent) return;

        Alert.alert(
          t('create.draftFound'),
          t('create.draftFoundDesc'),
          [
            { 
              text: t('create.discardDraft'), 
              onPress: () => AsyncStorage.removeItem(INVOICE_CONSTANTS.DRAFT_KEY),
              style: 'cancel',
            },
            {
              text: t('create.restoreDraft'),
              onPress: () => {
                setValue('customerName', draft.customerName);
                setItems(draft.items);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              },
            },
          ]
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to load draft:', error);
    }
  }, [setValue, t]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // ============================================================================
  // Focus Management
  // ============================================================================

  useEffect(() => {
    // Auto-focus first field when step changes
    const timeoutId = setTimeout(() => {
      if (currentStep === 'customer') {
        customerNameRef.current?.focus();
      } else if (currentStep === 'items' && editingIndex === null) {
        descriptionRef.current?.focus();
      }
    }, 300); // Wait for animation

    return () => clearTimeout(timeoutId);
  }, [currentStep, editingIndex]);

  // ============================================================================
  // Item Management
  // ============================================================================

  const resetItemForm = useCallback(() => {
    setValue('description', '');
    setValue('quantity', '1');
    setValue('unitPrice', '');
    setEditingIndex(null);
  }, [setValue]);

  const addItem = useCallback(() => {
    if (!validateFields(['description', 'quantity', 'unitPrice'])) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('alerts.validationError'), t('alerts.fixErrorsBeforeAdding'));
      return;
    }

    if (items.length >= INVOICE_CONSTANTS.MAX_ITEMS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        type: 'warning',
        message: t('alerts.maxItemsReached'),
        haptic: 'warning',
        duration: 4000
      });
      return;
    }

    const quantity = Number(values.quantity);
    const unitPrice = Number(values.unitPrice);

    if (editingIndex !== null) {
      // Update existing item
      const updatedItems = [...items];
      updatedItems[editingIndex] = { 
        description: values.description.trim(), 
        quantity, 
        unitPrice 
      };
      setItems(updatedItems);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Add new item
      setItems((prev) => [...prev, { 
        description: values.description.trim(), 
        quantity, 
        unitPrice 
      }]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    resetItemForm();
    descriptionRef.current?.focus();
  }, [validateFields, values, items, editingIndex, resetItemForm, t]);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      resetItemForm();
    }
  }, [editingIndex, resetItemForm]);

  const editItem = useCallback((index: number) => {
    const item = items[index];
    setValue('description', item.description);
    setValue('quantity', item.quantity.toString());
    setValue('unitPrice', item.unitPrice.toString());
    setEditingIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    descriptionRef.current?.focus();
  }, [items, setValue]);

  // ============================================================================
  // Navigation
  // ============================================================================

  const canGoToStep = useCallback((targetStep: WizardStep): boolean => {
    const targetIndex = steps.findIndex(s => s.key === targetStep);
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    
    // Can always go back
    if (targetIndex < currentIndex) return true;
    
    // Can only go forward if current step is valid
    if (targetStep === 'items') {
      return true; // Customer step is optional
    }
    if (targetStep === 'review') {
      return items.length > 0;
    }
    
    return false;
  }, [currentStep, items.length, steps]);

  const navigateToStep = useCallback((targetStep: WizardStep) => {
    if (canGoToStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  }, [canGoToStep]);

  const goToNextStep = useCallback(() => {
    if (currentStep === 'customer') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep('items');
    } else if (currentStep === 'items') {
      if (items.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showValidationError(t('alerts.noItems'), t('alerts.addItemBeforeProceeding'));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep('review');
    }
  }, [currentStep, items.length, t]);

  const goToPrevStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'items') {
      setCurrentStep('customer');
    } else if (currentStep === 'review') {
      setCurrentStep('items');
    }
  }, [currentStep]);

  // ============================================================================
  // OCR Integration (Simplified)
  // ============================================================================

  const openScanMenu = useCallback(async () => {
    if (!receiptsScannerEnabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void trackEvent('invoice', 'scan_menu_opened');
    
    // In production, this would import and use the OCR service
    Alert.alert(
      t('alerts.scanReceipt'),
      t('alerts.scanReceiptDesc'),
      [
        {
          text: t('alerts.takePhoto'),
          onPress: () => setShowCamera(true),
          style: 'default',
        },
        {
          text: t('alerts.chooseFromGallery'),
          onPress: () => {
            // Gallery selection - future enhancement
          },
          style: 'default',
        },
        {
          text: t('settings.cancel'),
          style: 'cancel',
        },
      ]
    );
  }, [receiptsScannerEnabled, t]);

  // Open scan menu if requested via navigation parameter
  useEffect(() => {
    if (shouldOpenScan && receiptsScannerEnabled) {
      // Delay slightly to ensure component is fully mounted
      const timer = setTimeout(() => {
        openScanMenu();
        setShouldOpenScan(false); // Reset after opening
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldOpenScan, receiptsScannerEnabled, openScanMenu]);

  // ============================================================================
  // OCR Processing Handlers
  // ============================================================================

  const handleCameraCapture = useCallback(async (imageUri: string) => {
    setShowCamera(false);
    setOcrLoading(true);    
    setOcrImageUri(imageUri);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void trackEvent('ocr', 'capture_started');

    try {
      const apiBaseUrl = await getApiBaseUrl();
      const result = await extractReceiptData(imageUri, apiBaseUrl, {
        timeoutMs: 30000,
        maxRetries: 2,
      });

      if (result.confidence < INVOICE_CONSTANTS.OCR_MIN_CONFIDENCE) {
        // Low confidence - show error modal
        setOcrError('lowConfidence');
        setShowOcrError(true);
        void trackEvent('ocr', 'low_confidence', undefined, result.confidence, { confidence: result.confidence });
      } else {
        // Success - show review modal
        setOcrResult(result);
        setShowOcrReview(true);
        void trackEvent('ocr', 'extraction_success', undefined, result.confidence, { confidence: result.confidence });
      }
    } catch (error: any) {
      // Handle errors
      let errorType: ScanErrorType = 'networkError';
      
      if (error.message === 'IMAGE_TOO_LARGE') {
        errorType = 'lowQuality';
      } else if (error.name === 'TimeoutError') {
        errorType = 'timeout';
      } else if (!isOnline) {
        errorType = 'networkError';
      }

      setOcrError(errorType);
      setShowOcrError(true);
      void trackEvent('ocr', 'extraction_failed', errorType, undefined, { error: error.message });
    } finally {
      setOcrLoading(false);
    }
  }, [isOnline]);

  const handleOcrDataAccept = useCallback((editedData: EditedData) => {
    setShowOcrReview(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Populate customer name if provided
    if (editedData.vendor) {
      setValue('customerName', editedData.vendor);
    }

    // Add items if provided
    if (editedData.items && editedData.items.length > 0) {
      setItems(prev => [...prev, ...editedData.items!]);
      showToast({
        type: 'success',
        message: t('ocr.itemsFound', { count: editedData.items.length }),
        haptic: 'success',
      });
    }

    // Go to items step
    setCurrentStep('items');
    
    void trackEvent('ocr', 'data_accepted', undefined, editedData.items?.length || 0, {
      itemsAdded: editedData.items?.length || 0,
      hasVendor: !!editedData.vendor,
    });
  }, [setValue, t]);

  const handleOcrRescan = useCallback(() => {
    setShowOcrReview(false);
    setShowOcrError(false);
    setOcrResult(null);
    setOcrImageUri(null);
    
    // Reopen camera
    setTimeout(() => setShowCamera(true), 300);
    
    void trackEvent('ocr', 'rescan_requested');
  }, []);

  const handleOcrManualEntry = useCallback(() => {
    setShowOcrReview(false);
    setShowOcrError(false);
    setOcrResult(null);
    setOcrImageUri(null);
    
    // Go to items step for manual entry
    setCurrentStep('items');
    
    void trackEvent('ocr', 'manual_entry_chosen');
  }, []);

  const handleOcrErrorDismiss = useCallback(() => {
    setShowOcrError(false);
    setOcrError(null);
  }, []);

  // ============================================================================
  // Save Invoice
  // ============================================================================

  const save = useCallback(async () => {
    if (!offlineInvoicesEnabled && !isOnline) {
      showToast({
        type: 'warning',
        message: t('sync.offlineBody'),
        haptic: 'warning'
      });
      return;
    }

    if (!items.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showValidationError(t('alerts.noItems'), t('alerts.addItemToInvoice'));
      return;
    }

    setLoading(true);
    setLoadingMessage(t('alerts.savingInvoice'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const id = createLocalId();
      await saveInvoice({
        id,
        customerName: values.customerName.trim() || undefined,
        customerTIN: values.customerTIN.trim() || undefined,
        status: 'queued',
        subtotal: totals.subtotal,
        vat: totals.vat,
        total: totals.total,
        items,
        createdAt: new Date().toISOString(),
        synced: 0
      });

      void trackInvoiceCreated(items.length, totals.total, !isOnline);

      // Enqueue to sync queue when device sync is enabled (fire-and-forget)
      if (String(process.env.EXPO_PUBLIC_FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true') {
        enqueueSyncQueueItem({
          entity: 'invoice',
          action: 'create',
          payload: {
            id,
            customerName: values.customerName.trim() || undefined,
            customerTIN: values.customerTIN.trim() || undefined,
            subtotal: totals.subtotal,
            vat: totals.vat,
            total: totals.total,
            items,
          },
        }).catch(() => {});
      }

      // Clear draft on successful save
      await AsyncStorage.removeItem(INVOICE_CONSTANTS.DRAFT_KEY);

      resetForm();
      setItems([]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      props.navigation.navigate('Invoices');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const message = err instanceof Error ? err.message : t('alerts.saveFailedDesc');
      
      if (String(message).toLowerCase().includes('storage')) {
        Alert.alert(
          t('alerts.storageFull'), 
          t('alerts.storageFullDesc'), 
          [
            { 
              text: t('alerts.clearOldSynced'), 
              onPress: async () => {
                try {
                  const db = require('../services/database');
                  const removed = await db.clearSyncedLocalInvoices(7);
                  showToast({
                    type: 'success',
                    message: `${t('alerts.removed')} ${removed} ${t('alerts.oldSyncedInvoices')}. ${t('alerts.pleaseRetry')}`,
                    haptic: 'success',
                    duration: 5000
                  });
                } catch (e) {
                  showValidationError(t('alerts.cleanupFailed'), t('alerts.cleanupFailedDesc'));
                }
              }
            },
            { text: t('settings.cancel'), style: 'cancel' },
          ]
        );
      } else {
        showValidationError(t('alerts.saveFailed'), message);
      }
      
      if (__DEV__) console.error('Save invoice failed', err);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [items, values.customerName, totals, resetForm, setLoading, setLoadingMessage, t, props.navigation, offlineInvoicesEnabled, isOnline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <SafeAreaView style={styles.safe}>
      <InvoiceWizard />
      <KeyboardAvoidingView 
        behavior={Platform.select({ ios: 'padding', android: undefined })} 
        style={styles.safe}
      >
        {/* Step Indicator */}
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepPress={navigateToStep}
        />

        <ScrollView 
          contentContainerStyle={styles.container} 
          keyboardShouldPersistTaps="handled"
          accessible={true}
          accessibilityLabel={t('create.mainContent')}
        >
          {/* Step 1: Customer Details */}
          {currentStep === 'customer' && (
            <Animated.View entering={FadeInRight.duration(300)} style={styles.stepContent}>
              <Text 
                style={styles.h1}
                accessibilityRole="header"
              >
                {t('create.title')}
              </Text>
              <Text style={styles.stepDescription}>{t('create.customerOptional')}</Text>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>👤</Text>
                  <Text style={styles.cardTitle}>{t('create.customerInfo')}</Text>
                </View>

                <Text style={styles.label}>{t('create.customer')}</Text>
                <TextInput
                  ref={customerNameRef}
                  value={values.customerName}
                  onChangeText={(text) => setValue('customerName', text)}
                  onBlur={() => setTouchedField('customerName')}
                  placeholder={t('create.customerPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, errors.customerName && touched.customerName && styles.inputError]}
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                  accessible={true}
                  accessibilityLabel={t('create.customer')}
                />
                {errors.customerName && touched.customerName && (
                  <Text style={styles.errorText}>{errors.customerName}</Text>
                )}

                <Text style={styles.label}>{t('create.customerTinLabel')}</Text>
                <TextInput
                  value={values.customerTIN}
                  onChangeText={(text) => setValue('customerTIN', text)}
                  onBlur={() => setTouchedField('customerTIN')}
                  placeholder={t('create.customerTinPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, errors.customerTIN && touched.customerTIN && styles.inputError]}
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                  autoCapitalize="characters"
                  accessible={true}
                  accessibilityLabel={t('create.customerTinAccessibility')}
                />
                {errors.customerTIN && touched.customerTIN && (
                  <Text style={styles.errorText}>{errors.customerTIN}</Text>
                )}

                <View style={styles.tipBox}>
                  <Text style={styles.tipIcon}>💡</Text>
                  <Text style={styles.tipText}>{t('create.tipWalkIn')}</Text>
                </View>
              </View>

              <AnimatedButton
                title={t('common.continueItems')}
                onPress={goToNextStep}
                style={styles.primaryButton}
              />
            </Animated.View>
          )}

          {/* Step 2: Add Items */}
          {currentStep === 'items' && (
            <Animated.View entering={FadeInRight.duration(300)} style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <Pressable onPress={goToPrevStep} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← {t('create.backButton')}</Text>
                </Pressable>
                <Text 
                  style={styles.h1}
                  accessibilityRole="header"
                >
                  {t('create.addItem')}
                </Text>
              </View>
              <Text style={styles.stepDescription}>{t('common.addProducts')}</Text>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>📦</Text>
                  <Text style={styles.cardTitle}>
                    {editingIndex !== null 
                      ? t('create.editingItem') 
                      : t('common.newItem')}
                  </Text>
                </View>

                <Text style={styles.label}>{t('create.description')}</Text>
                <TextInput 
                  ref={descriptionRef}
                  value={values.description} 
                  onChangeText={(text) => setValue('description', text)}
                  onBlur={() => setTouchedField('description')}
                  placeholder={t('common.itemPlaceholder')} 
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, errors.description && touched.description && styles.inputError]}
                  returnKeyType="next"
                  onSubmitEditing={() => quantityRef.current?.focus()}
                  accessibilityLabel={t('create.description')}
                />
                {errors.description && touched.description && (
                  <Text style={styles.errorText}>{errors.description}</Text>
                )}

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('create.quantity')}</Text>
                    <TextInput 
                      ref={quantityRef}
                      value={values.quantity} 
                      onChangeText={(text) => setValue('quantity', text)}
                      onBlur={() => setTouchedField('quantity')}
                      keyboardType="numeric" 
                      style={[styles.input, errors.quantity && touched.quantity && styles.inputError]}
                      returnKeyType="next"
                      onSubmitEditing={() => unitPriceRef.current?.focus()}
                      accessibilityLabel={t('create.quantity')}
                    />
                    {errors.quantity && touched.quantity && (
                      <Text style={styles.errorText}>{errors.quantity}</Text>
                    )}
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('create.unitPrice')} (₦)</Text>
                    <TextInput 
                      ref={unitPriceRef}
                      value={values.unitPrice} 
                      onChangeText={(text) => setValue('unitPrice', text)}
                      onBlur={() => setTouchedField('unitPrice')}
                      keyboardType="numeric" 
                      style={[styles.input, errors.unitPrice && touched.unitPrice && styles.inputError]}
                      returnKeyType="done"
                      onSubmitEditing={addItem}
                      accessibilityLabel={t('create.unitPrice')}
                    />
                    {errors.unitPrice && touched.unitPrice && (
                      <Text style={styles.errorText}>{errors.unitPrice}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <AnimatedButton 
                    title={editingIndex !== null ? t('common.updateItem') : t('common.addItem')}
                    onPress={addItem}
                    variant={editingIndex !== null ? 'primary' : 'secondary'}
                    style={styles.addItemButton}
                  />
                  {editingIndex !== null && (
                    <AnimatedButton 
                      title={t('common.cancel')}
                      onPress={() => {
                        resetItemForm();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      variant="secondary"
                      style={styles.cancelButton}
                    />
                  )}
                  {receiptsScannerEnabled && editingIndex === null && (
                    <AnimatedButton 
                      title={t('common.scan')}
                      onPress={openScanMenu}
                      variant="primary"
                      style={styles.scanButton}
                      testID="button-scanReceipt"
                      accessibilityHint={t('create.scanReceiptHint')}
                    />
                  )}
                </View>
              </View>

              {/* Items List */}
              {items.length > 0 && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>📋</Text>
                    <Text style={styles.cardTitle}>
                      {t('create.itemsAdded')} ({items.length})
                    </Text>
                  </View>

                  {items.map((item, idx) => (
                    <ItemCard
                      key={`${idx}-${item.description}`}
                      item={item}
                      index={idx}
                      onRemove={removeItem}
                      onEdit={editItem}
                    />
                  ))}
                </Animated.View>
              )}

              {/* Totals Summary */}
              {items.length > 0 && <TotalsSummary totals={totals} variant="compact" />}

              <AnimatedButton
                title={items.length > 0 ? t('create.reviewInvoice') : t('create.addItemsToContinue')}
                onPress={goToNextStep}
                style={items.length === 0 ? [styles.primaryButton, styles.buttonDisabled] : styles.primaryButton}
                disabled={items.length === 0}
              />
            </Animated.View>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 'review' && (
            <Animated.View entering={FadeInRight.duration(300)} style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <Pressable onPress={goToPrevStep} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← {t('create.backButton')}</Text>
                </Pressable>
                <Text 
                  style={styles.h1}
                  accessibilityRole="header"
                >
                  {t('create.reviewTitle')}
                </Text>
              </View>
              <Text style={styles.stepDescription}>{t('create.confirmDetails')}</Text>

              {/* Customer Card */}
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewIcon}>👤</Text>
                  <Text style={styles.reviewTitle}>{t('create.customerLabel')}</Text>
                </View>
                <Text style={styles.reviewValue}>
                  {values.customerName.trim() || t('create.walkInCustomer')}
                </Text>
              </View>

              {/* Items Card */}
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewIcon}>📦</Text>
                  <Text style={styles.reviewTitle}>
                    {t('create.itemsLabel')} ({items.length})
                  </Text>
                </View>
                {items.map((item, idx) => (
                  <View key={idx} style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>{item.description}</Text>
                    <Text style={styles.reviewItemPrice}>
                      {item.quantity} × ₦{item.unitPrice.toFixed(2)} = ₦{(item.quantity * item.unitPrice).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Totals Card */}
              <TotalsSummary totals={totals} variant="detailed" />

              {/* Tax Breakdown Intelligence */}
              <TaxIntelligencePanel
                breakdown={{
                  subtotal: totals.subtotal,
                  vatApplied: {
                    rate: INVOICE_CONSTANTS.VAT_RATE,
                    amount: totals.vat,
                  },
                  exemptions: [],
                  total: totals.total
                }}
                onLearnMore={() => navigation.navigate('TaxGuide')}
              />

              {/* Compliance Notice */}
              <View style={styles.complianceNotice}>
                <Text style={styles.complianceIcon}>🏛️</Text>
                <Text style={styles.complianceText}>
                  {t('create.complianceNotice')}
                </Text>
              </View>

              <AnimatedButton
                title={t('create.save')}
                onPress={save}
                style={styles.saveButton}
              />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Camera Modal (Lazy Loaded) */}
      {receiptsScannerEnabled && showCamera && (
        <Suspense fallback={<SkeletonLoader type="invoice-card" count={1} />}>
          <CameraModal
            visible={showCamera}
            facing={cameraFacing}
            onCapture={handleCameraCapture}
            onFlip={() => setCameraFacing(prev => prev === 'back' ? 'front' : 'back')}
            onClose={() => setShowCamera(false)}
          />
        </Suspense>
      )}

      {/* OCR Loading Indicator */}
      {ocrLoading && (
        <View style={styles.loadingOverlay}>
          <SkeletonLoader type="invoice-card" count={1} animated />
          <Text style={styles.loadingText}>{t('alerts.analyzingReceipt')}</Text>
        </View>
      )}

      {/* OCR Data Review Modal */}
      {showOcrReview && ocrResult && ocrImageUri && (
        <ExtractedDataReview
          imageUri={ocrImageUri}
          extractedData={ocrResult}
          onAccept={handleOcrDataAccept}
          onRescan={handleOcrRescan}
          onManualEntry={handleOcrManualEntry}
        />
      )}

      {/* OCR Error Modal */}
      {showOcrError && ocrError && (
        <ScanErrorModal
          visible={showOcrError}
          errorType={ocrError}
          onRetry={handleOcrRescan}
          onManualEntry={handleOcrManualEntry}
          onDismiss={handleOcrErrorDismiss}
        />
      )}
    </SafeAreaView>
  );
}

export default memo(CreateInvoiceScreen);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl * 4 },
  
  // Step Indicator
  stepIndicatorContainer: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepCircle: {
    width: spacing.xxl + spacing.lg,
    height: spacing.xxl + spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSlate,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: spacing.xxs,
    borderColor: colors.borderSubtle,
  },
  stepCircleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  stepCircleComplete: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepIcon: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  stepIconActive: {
    color: colors.primary,
  },
  stepLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
    position: 'absolute',
    bottom: -(spacing.lg + spacing.xxs),
    width: spacing.xxl * 2 + spacing.md,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  stepConnector: {
    width: spacing.xxl + spacing.lg,
    height: spacing.xxs,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.sm,
  },
  stepConnectorActive: {
    backgroundColor: colors.success,
  },
  
  // Step Content
  stepContent: {
    paddingTop: spacing.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingVertical: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSlate,
    borderRadius: radii.sm,
  },
  backButtonText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
  },
  
  // Headers & Text
  h1: { 
    fontSize: typography.size.xl, 
    fontWeight: typography.weight.extrabold, 
    color: colors.textPrimary,
    flex: 1,
  },
  label: { 
    color: colors.textSecondary, 
    marginBottom: spacing.xs + spacing.xxs, 
    fontWeight: typography.weight.bold, 
    fontSize: typography.size.sm 
  },
  
  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  cardIcon: {
    fontSize: typography.size.xl,
  },
  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  
  // Inputs
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    fontSize: typography.size.md,
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
    marginTop: -spacing.sm,
    fontWeight: typography.weight.medium,
  },
  
  // Tip Box
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successBg,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  tipIcon: {
    fontSize: typography.size.md,
  },
  tipText: {
    flex: 1,
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.successDark,
    lineHeight: spacing.lg + spacing.xxs,
  },
  
  // Layout
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  addItemButton: {
    flex: 2,
  },
  cancelButton: {
    flex: 1,
  },
  scanButton: {
    flex: 1,
    minWidth: 100,
  },
  
  // Items List
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSlate,
    padding: spacing.md,
    borderRadius: radii.sm + spacing.xxs,
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  itemDetails: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemTotal: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  editButton: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: typography.size.md,
    color: colors.info,
    fontWeight: typography.weight.semibold,
  },
  removeButton: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.errorBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: typography.size.lg,
    color: colors.error,
    fontWeight: typography.weight.semibold,
  },
  
  // Sticky Summary
  stickySummary: {
    backgroundColor: colors.primaryDeep,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimarySubtle,
  },
  summaryValue: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimaryStrong,
    fontWeight: typography.weight.semibold,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.overlayLightStrong,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  summaryTotalLabel: {
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
  },
  summaryTotalValue: {
    fontSize: typography.size.xl,
    color: colors.success,
    fontWeight: typography.weight.black,
  },
  
  // Buttons
  primaryButton: {
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  
  // Review Step
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  reviewIcon: {
    fontSize: typography.size.lg,
  },
  reviewTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  reviewValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  reviewItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  reviewItemName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  reviewItemPrice: {
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.textMuted,
  },
  
  // Totals Card
  totalsCard: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  totalBreakdown: {
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimarySubtle,
  },
  totalValue: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimaryStrong,
    fontWeight: typography.weight.semibold,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.overlayLightStrong,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  grandTotalLabel: {
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
  },
  grandTotalValue: {
    fontSize: typography.size.xl + spacing.xxs,
    color: colors.success,
    fontWeight: typography.weight.black,
  },
  
  // Compliance Notice
  complianceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm + spacing.xxs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  complianceIcon: {
    fontSize: typography.size.lg,
  },
  complianceText: {
    flex: 1,
    fontSize: typography.size.xs + spacing.xxs,
    color: colors.infoText,
    lineHeight: spacing.lg + spacing.xxs,
  },
  
  // Save Button
  saveButton: {
    marginTop: spacing.sm,
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    color: colors.textOnPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});