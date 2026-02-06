import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';
import { Camera, CameraType, PermissionStatus } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { useHapticFeedback } from '../../utils/haptics';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

type DemoStep = 'intro' | 'permission' | 'camera' | 'processing' | 'preview';

// Mock extracted receipt data for demo
const DEMO_RECEIPT_DATA = {
  vendor: 'Mama Tolu\'s Store',
  amount: 15750,
  date: new Date().toLocaleDateString('en-NG'),
  items: [
    { name: 'Rice (50kg bag)', price: 12000 },
    { name: 'Vegetable Oil (5L)', price: 3750 },
  ],
};

export default function OCRScannerDemo({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const triggerHaptic = useHapticFeedback();

  const [demoStep, setDemoStep] = useState<DemoStep>('intro');
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);

  // Request camera permission
  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
      
      if (status === PermissionStatus.GRANTED) {
        triggerHaptic('notificationSuccess');
        setDemoStep('camera');
      } else {
        triggerHaptic('notificationError');
        Alert.alert(
          t('onboarding.permissionDenied'),
          t('onboarding.cameraRationale'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => setDemoStep('intro') },
            { text: t('onboarding.openSettings'), onPress: () => {
              // On real app, would open settings
              setDemoStep('intro');
            }},
          ]
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
      triggerHaptic('notificationError');
      setDemoStep('intro');
    }
  }, [t, triggerHaptic]);

  // Simulate scan process
  const handleScanDemo = useCallback(() => {
    triggerHaptic('impactMedium');
    setDemoStep('processing');
    
    // Simulate OCR processing time
    setTimeout(() => {
      triggerHaptic('notificationSuccess');
      setDemoStep('preview');
    }, 2500);
  }, [triggerHaptic]);

  // Skip to preview (for demo without camera)
  const skipToPreview = useCallback(() => {
    triggerHaptic('impactLight');
    setDemoStep('preview');
  }, [triggerHaptic]);

  const flowSteps = [
    {
      step: 1,
      icon: 'camera',
      label: t('onboarding.scanStep1'),
      color: colors.primary,
    },
    {
      step: 2,
      icon: 'scan',
      label: t('onboarding.scanStep2'),
      color: colors.accent,
    },
    {
      step: 3,
      icon: 'checkmark-done',
      label: t('onboarding.scanStep3'),
      color: colors.success,
    },
  ];

  // Intro view
  if (demoStep === 'intro') {
    return (
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="scan" size={48} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>{t('onboarding.scannerTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.scannerSubtitle')}</Text>
        </Animated.View>

        {/* Flow Steps */}
        <Animated.View entering={SlideInRight.delay(200)} style={styles.flowSection}>
          {flowSteps.map((item, index) => (
            <View key={item.step} style={styles.flowStep}>
              <View style={[styles.flowIcon, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={32} color={item.color} />
              </View>
              <View style={styles.flowContent}>
                <Text style={styles.flowStepNumber}>
                  {t('onboarding.stepNumber', { number: item.step })}
                </Text>
                <Text style={styles.flowStepLabel}>{item.label}</Text>
              </View>
              {index < flowSteps.length - 1 && (
                <View style={styles.flowConnector} />
              )}
            </View>
          ))}
        </Animated.View>

        {/* Try Demo Section */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.demoSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setDemoStep('permission')}
            accessibilityLabel={t('onboarding.tryScanner')}
            accessibilityRole="button"
          >
            <Ionicons name="camera" size={24} color={colors.white} />
            <Text style={styles.primaryButtonText}>{t('onboarding.tryScanner')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={skipToPreview}
            accessibilityLabel={t('onboarding.viewSampleScan')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>{t('onboarding.viewSampleScan')}</Text>
          </TouchableOpacity>

          {onSkip && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              accessibilityLabel={t('onboarding.skipScanner')}
              accessibilityRole="button"
            >
              <Text style={styles.skipButtonText}>{t('onboarding.skipScanner')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    );
  }

  // Permission request view
  if (demoStep === 'permission') {
    return (
      <View style={styles.centeredContainer}>
        <Animated.View entering={FadeIn} style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={64} color={colors.primary} />
          <Text style={styles.title}>{t('onboarding.cameraPermissionTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.cameraRationale')}</Text>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestPermission}
            accessibilityLabel={t('onboarding.grantPermission')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{t('onboarding.grantPermission')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setDemoStep('intro')}
            accessibilityLabel={t('common.cancel')}
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // Camera view (live demo)
  if (demoStep === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          type={CameraType.back}
          ratio="16:9"
        >
          {/* AR Overlay Guide */}
          <View style={styles.cameraOverlay}>
            <View style={styles.scanGuide}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>

            <Animated.View entering={FadeIn} style={styles.guidanceContainer}>
              <Text style={styles.guidanceText}>
                {t('onboarding.scanGuidance')}
              </Text>
            </Animated.View>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleScanDemo}
              accessibilityLabel={t('onboarding.captureReceipt')}
              accessibilityRole="button"
            >
              <View style={styles.captureButtonInner}>
                <Ionicons name="camera" size={32} color={colors.white} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDemoStep('intro')}
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Camera>
      </View>
    );
  }

  // Processing view
  if (demoStep === 'processing') {
    return (
      <View style={styles.centeredContainer}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.processingCard}>
          <Animated.View
            entering={FadeIn}
            style={styles.processingAnimation}
          >
            <Ionicons name="scan" size={64} color={colors.primary} />
          </Animated.View>
          <Text style={styles.processingTitle}>{t('onboarding.analyzingReceipt')}</Text>
          <Text style={styles.processingSubtitle}>{t('onboarding.extractingData')}</Text>
        </Animated.View>
      </View>
    );
  }

  // Preview extracted data
  if (demoStep === 'preview') {
    return (
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.previewHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.title}>{t('onboarding.scanComplete')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.reviewExtractedData')}</Text>
        </Animated.View>

        <Animated.View entering={SlideInRight.delay(200)} style={styles.extractedDataCard}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{t('scanner.fields.vendor')}</Text>
            <Text style={styles.dataValue}>{DEMO_RECEIPT_DATA.vendor}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{t('scanner.fields.date')}</Text>
            <Text style={styles.dataValue}>{DEMO_RECEIPT_DATA.date}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{t('scanner.fields.amount')}</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.dataValue}>
                ₦{DEMO_RECEIPT_DATA.amount.toLocaleString('en-NG')}
              </Text>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceBadgeText}>95%</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.itemsTitle}>{t('scanner.fields.items')}</Text>
          {DEMO_RECEIPT_DATA.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                ₦{item.price.toLocaleString('en-NG')}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(400)} style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onNext}
            accessibilityLabel={t('onboarding.scanFirst')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{t('onboarding.scanFirst')}</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setDemoStep('intro')}
            accessibilityLabel={t('onboarding.tryAgain')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>{t('onboarding.tryAgain')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  flowSection: {
    marginBottom: spacing.lg,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  flowIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowContent: {
    flex: 1,
    marginLeft: spacing.md,
    paddingTop: spacing.xs,
  },
  flowStepNumber: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  flowStepLabel: {
    ...typography.body,
    color: colors.text,
  },
  flowConnector: {
    position: 'absolute',
    left: 31,
    top: 64,
    width: 2,
    height: 40,
    backgroundColor: colors.gray300,
  },
  demoSection: {
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
   paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  permissionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: `0 4px 8px ${colors.shadow}30`,
      },
    }),
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  scanGuide: {
    width: 280,
    height: 400,
    borderWidth: 2,
    borderColor: colors.white,
    borderStyle: 'dashed',
    position: 'relative',
    marginTop: spacing.xxl,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  guidanceContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  guidanceText: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 300,
  },
  processingAnimation: {
    marginBottom: spacing.md,
  },
  processingTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  processingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  extractedDataCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: `0 2px 4px ${colors.shadow}20`,
      },
    }),
  },
  dataRow: {
    marginBottom: spacing.md,
  },
  dataLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dataValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confidenceBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  confidenceBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.md,
  },
  itemsTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  itemName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  itemPrice: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
  },
});
