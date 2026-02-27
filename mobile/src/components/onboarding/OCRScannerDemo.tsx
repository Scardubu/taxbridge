import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DURATION } from '../../design-system/animation';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

type DemoStep = 'intro' | 'permission' | 'camera' | 'processing' | 'preview';

export default function OCRScannerDemo({ onNext, onSkip }: Props) {
  const { t, i18n } = useTranslation();
  const haptics = useHapticFeedback();

  const demoReceiptData = useMemo(
    () => ({
      vendor: t('onboarding.scanner.demo.vendor'),
      amount: 15750,
      date: t('onboarding.scanner.demo.date'),
      items: [
        { name: t('onboarding.scanner.demo.item1'), price: 12000 },
        { name: t('onboarding.scanner.demo.item3'), price: 3750 },
      ],
    }),
    [t, i18n.language]
  );

  const [demoStep, setDemoStep] = useState<DemoStep>('intro');
  const [permission, requestPermission] = useCameraPermissions();
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);

  // Request camera permission
  const handleRequestPermission = useCallback(async () => {
    try {
      const result = await requestPermission();
      
      if (result.granted) {
        haptics.success();
        setDemoStep('camera');
      } else {
        haptics.error();
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
      if (__DEV__) console.error('Permission request error:', error);
      haptics.error();
      setDemoStep('intro');
    }
  }, [t, haptics, requestPermission]);

  // Simulate scan process
  const handleScanDemo = useCallback(() => {
    haptics.medium();
    setDemoStep('processing');
    
    // Simulate OCR processing time
    setTimeout(() => {
      haptics.success();
      setDemoStep('preview');
    }, 2500);
  }, [haptics]);

  // Skip to preview (for demo without camera)
  const skipToPreview = useCallback(() => {
    haptics.light();
    setDemoStep('preview');
  }, [haptics]);

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
      color: colors.info,
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
        <Animated.View entering={FadeIn.duration(DURATION.transition)} style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="scan" size={48} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>{t('onboarding.scanner.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.scanner.subtitle')}</Text>
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
            <Ionicons name="camera" size={24} color={colors.surface} />
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
            onPress={handleRequestPermission}
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
        <CameraView
          style={styles.camera}
          facing="back"
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
                <Ionicons name="camera" size={32} color={colors.surface} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDemoStep('intro')}
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.surface} />
            </TouchableOpacity>
          </View>
        </CameraView>
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
            <Text style={styles.dataLabel}>{t('onboarding.scanner.vendor')}</Text>
            <Text style={styles.dataValue}>{demoReceiptData.vendor}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{t('onboarding.scanner.date')}</Text>
            <Text style={styles.dataValue}>{demoReceiptData.date}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{t('onboarding.scanner.amount')}</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.dataValue}>
                ₦{demoReceiptData.amount.toLocaleString('en-NG')}
              </Text>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceBadgeText}>95%</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.itemsTitle}>{t('onboarding.scanner.items')}</Text>
          {demoReceiptData.items.map((item, index) => (
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
            <Ionicons name="arrow-forward" size={20} color={colors.surface} />
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
    backgroundColor: colors.surface,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
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
    color: colors.textPrimary,
  },
  flowConnector: {
    position: 'absolute',
    left: 31,
    top: 64,
    width: 2,
    height: 40,
    backgroundColor: colors.borderSubtle,
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
    ...typography.bodyBold,
    color: colors.surface,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
   paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadowPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: `0 4px 8px ${colors.shadowPrimary}30`,
      },
    }),
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
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
    borderColor: colors.surface,
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
    color: colors.surface,
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
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadowPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: `0 2px 4px ${colors.shadowPrimary}20`,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.surfaceSecondary,
    marginVertical: spacing.md,
  },
  itemsTitle: {
    fontSize: typography.size.xl,
    lineHeight: 28,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  itemName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  itemPrice: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
  },
});
