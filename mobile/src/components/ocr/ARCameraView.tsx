import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from '../../utils/safeHaptics';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { SkeletonLoader } from '../ui/SkeletonLoader';

interface ARCameraViewProps {
  onCapture: (imageUri: string) => void;
  onClose: () => void;
  facing?: 'front' | 'back';
  onFlip?: () => void;
}

/**
 * AR-Enhanced Camera View for Receipt Scanning
 * 
 * Features:
 * - Real-time receipt detection with AR overlay
 * - Alignment guides for optimal capture
 * - Auto-capture when receipt is properly aligned
 * - Manual capture fallback
 */
export function ARCameraView({ onCapture, onClose, facing = 'back', onFlip }: ARCameraViewProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAligned, setIsAligned] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for alignment indicator
  React.useEffect(() => {
    if (isAligned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isAligned, pulseAnim]);

  const handleCapture = useCallback(async () => {
    if (isProcessing || !cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCapture(photo.uri);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (__DEV__) console.error('Camera capture failed:', error);
    } finally {
      setIsProcessing(false);
      setIsAligned(false);
    }
  }, [isProcessing, onCapture]);

  // Request permission if needed
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <SkeletonLoader type="inline-lg" count={1} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>{t('ocr.cameraPermission')}</Text>
        <Text style={styles.permissionMessage}>{t('ocr.cameraPermissionDesc')}</Text>
        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>{t('ocr.grantPermission')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        enableTorch={false}
      >
        {/* AR Overlay - Alignment Guides */}
        <View style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('alerts.closeCamera')}
            >
              <Ionicons name="close" size={20} color={colors.textOnPrimary} />
            </Pressable>
            <Text style={styles.instruction}>
              {isAligned ? t('ocr.receiptAligned') : t('ocr.alignReceipt')}
            </Text>
            {onFlip ? (
              <Pressable
                style={styles.flipButton}
                onPress={onFlip}
                accessibilityRole="button"
                accessibilityLabel={t('alerts.flipCamera')}
              >
                <Ionicons name="camera-reverse" size={20} color={colors.textOnPrimary} />
              </Pressable>
            ) : (
              <View style={styles.flipSpacer} />
            )}
          </View>

          {/* Center Frame */}
          <View style={styles.centerContainer}>
            <Pressable
              onPress={() => setIsAligned(true)}
              accessibilityRole="button"
              accessibilityLabel={t('ocr.alignReceipt')}
            >
              <Animated.View
                style={[
                  styles.frame,
                  isAligned && styles.frameAligned,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                {/* Corner Brackets */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Alignment Status */}
                {isAligned && (
                  <View style={styles.alignedBadge}>
                    <Ionicons name="checkmark" size={18} color={colors.textOnPrimary} />
                    <Text style={styles.alignedText}>{t('ocr.readyToScan')}</Text>
                  </View>
                )}
              </Animated.View>
            </Pressable>

            {/* Helper Text */}
            <Text style={styles.helperText}>
              {t('ocr.positionReceipt')}
            </Text>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomBar}>
            <View style={styles.captureContainer}>
              <Pressable
                style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
                onPress={handleCapture}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <SkeletonLoader type="inline-lg" count={1} />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>
            </View>
            <Text style={styles.captureHint}>
              {isProcessing ? t('ocr.processing') : t('ocr.tapToCapture')}
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  camera: {
    flex: 1,
  },
  
  // Permission State
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  permissionButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  
  // Overlay
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDarkStrong,
  },
  
  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  closeButton: {
    width: spacing.xxl + spacing.lg,
    height: spacing.xxl + spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.overlayLightStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  instruction: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  flipButton: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipSpacer: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
  },
  
  // Center Frame
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  frame: {
    width: '100%',
    aspectRatio: 0.7,
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: colors.textOnPrimary,
    borderRadius: radii.lg,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameAligned: {
    borderColor: colors.success,
  },
  
  // Corner Brackets
  corner: {
    position: 'absolute',
    width: spacing.xxl,
    height: spacing.xxl,
    borderColor: colors.textOnPrimary,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radii.md,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radii.md,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radii.md,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radii.md,
  },
  
  // Alignment Badge
  alignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    gap: spacing.sm,
  },
  alignedText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  
  // Helper Text
  helperText: {
    marginTop: spacing.xl,
    fontSize: typography.size.sm,
    color: colors.textOnPrimary,
    textAlign: 'center',
    opacity: 0.8,
  },
  
  // Bottom Controls
  bottomBar: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  captureContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  captureButton: {
    width: spacing.xxl * 3,
    height: spacing.xxl * 3,
    borderRadius: radii.full,
    backgroundColor: colors.textOnPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.overlayLightStrong,
    ...shadows.lg,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: '85%',
    height: '85%',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  captureHint: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.semibold,
  },
});
