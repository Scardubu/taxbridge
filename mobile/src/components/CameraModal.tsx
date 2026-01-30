import { useRef } from 'react';
import { Modal, View, Pressable, Text, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';

import { colors, spacing, radii, typography } from '../theme/tokens';

interface CameraModalProps {
  visible: boolean;
  facing: 'front' | 'back';
  onCapture: (uri: string, base64?: string) => void;
  onFlip: () => void;
  onClose: () => void;
}

export default function CameraModal({
  visible,
  facing,
  onCapture,
  onFlip,
  onClose,
}: CameraModalProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo.uri) {
        onCapture(photo.uri, photo.base64);
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            {t('alerts.cameraPermissionRequired')}
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>
              {t('alerts.grantPermission')}
            </Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />
        <View style={styles.controls}>
          <Pressable 
            style={styles.controlButton}
            onPress={onFlip}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.flipCamera')}
          >
            <Text style={styles.controlButtonText}>{t('alerts.flipCamera')}</Text>
          </Pressable>
          <Pressable 
            style={[styles.controlButton, styles.captureButton]}
            onPress={handleTakePicture}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('createInvoice.captureReceipt')}
          >
            <Text style={styles.controlButtonText}>📸</Text>
          </Pressable>
          <Pressable 
            style={styles.controlButton}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.closeCamera')}
          >
            <Text style={styles.controlButtonText}>{t('alerts.closeCamera')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  controlButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  captureButton: {
    paddingHorizontal: spacing.xxl + spacing.xs,
    paddingVertical: spacing.lg + spacing.xxs,
    backgroundColor: colors.success,
  },
  controlButtonText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.xxl,
  },
  permissionText: {
    fontSize: typography.size.lg,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  permissionButtonText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.md,
  },
  closeButton: {
    paddingVertical: spacing.sm,
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
});