import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ReceiptReviewForm } from '../../components/ReceiptReviewForm';
import { Colors, Radii, Spacing, Typography } from '../../components/design-system/tokens';
import { processReceiptImage } from '../../services/receiptOcr';
import { DuplicateReceiptError, RECEIPT_FALLBACK_BUSINESS_ID, receiptService } from '../../services/receiptService';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useIsOnboardingDone } from '../../stores/onboardingStore';
import { useReceiptStore } from '../../stores/receiptStore';
import type { DraftReceipt } from '../../types/receipt';

type Phase = 'camera' | 'review' | 'done';

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const isDone = useIsOnboardingDone();
  const businessId = useBusinessProfileStore((state) => state.businessId);
  const addReceipt = useReceiptStore((state) => state.addReceipt);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState<DraftReceipt | null>(null);
  const [ocrFailed, setOcrFailed] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || processing) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      const { draft: parsedDraft } = await processReceiptImage(photo.uri);
      if (!parsedDraft.amountNgn && !parsedDraft.vendorName) {
        setOcrFailed(true);
      }
      setDraft(parsedDraft);
      setPhase('review');
    } catch (error) {
      Sentry.captureException(error);
      setOcrFailed(true);
      setDraft({
        vendorName: '',
        vendorTin: null,
        amountNgn: 0,
        vatAmountNgn: 0,
        date: new Date().toISOString().split('T')[0],
        category: 'other',
        rawOcrText: null,
        imageHash: null,
        capturedAt: new Date().toISOString(),
      });
      setPhase('review');
    } finally {
      setProcessing(false);
    }
  }, [processing]);

  const handleSave = useCallback(async (confirmed: DraftReceipt) => {
    setProcessing(true);
    try {
      const record = await receiptService.saveReceipt(confirmed, businessId ?? RECEIPT_FALLBACK_BUSINESS_ID);
      addReceipt(record);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft(confirmed);
      setPhase('done');
    } catch (error) {
      if (error instanceof DuplicateReceiptError) {
        Alert.alert(t('receipts.duplicate'), t('receipts.duplicateBody'));
      } else {
        Sentry.captureException(error);
        Alert.alert(t('common.error'), t('receipts.saveError'));
      }
    } finally {
      setProcessing(false);
    }
  }, [addReceipt, businessId, t]);

  if (!isDone) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Colors.ui.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
        <Text style={{ fontSize: 40, marginBottom: Spacing.lg }}>🔒</Text>
        <Text style={{ ...Typography.title, color: Colors.ui.text, textAlign: 'center', marginBottom: Spacing.md }}>
          {t('receipts.title')}
        </Text>
        <Text style={{ ...Typography.body, color: Colors.ui.textMuted, textAlign: 'center', marginBottom: Spacing.xxl }}>
          {t('receipts.emptyBody')}
        </Text>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(onboarding)/business-type');
          }}
          accessibilityRole="button"
          style={{ backgroundColor: Colors.brand.primary, borderRadius: Radii.lg, paddingVertical: 16, paddingHorizontal: Spacing.xxl }}
        >
          <Text style={{ color: Colors.ui.white, fontWeight: '700' }}>{t('onboarding.getStarted')} →</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.ui.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.brand.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Colors.ui.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
        <Text style={{ fontSize: 40, marginBottom: Spacing.lg }}>📷</Text>
        <Text style={{ ...Typography.body, color: Colors.ui.textMuted, textAlign: 'center', marginBottom: Spacing.lg }}>
          {t('receipts.scanCta')}
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          style={{ backgroundColor: Colors.brand.primary, borderRadius: Radii.lg, paddingVertical: 16, paddingHorizontal: Spacing.xxl }}
        >
          <Text style={{ color: Colors.ui.white, fontWeight: '700' }}>{t('receipts.enableCamera')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'review' && draft) {
    return (
      <ReceiptReviewForm
        draft={draft}
        ocrFailed={ocrFailed}
        processing={processing}
        onSave={handleSave}
        onRetake={() => {
          setDraft(null);
          setOcrFailed(false);
          setPhase('camera');
        }}
      />
    );
  }

  if (phase === 'done') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Colors.ui.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
        <Text style={{ fontSize: 56, marginBottom: Spacing.lg }}>✅</Text>
        <Text style={{ ...Typography.title, color: Colors.ui.text, marginBottom: Spacing.sm, textAlign: 'center' }}>
          {t('receipts.saved')}
        </Text>
        <Text style={{ ...Typography.body, color: draft?.vatAmountNgn ? Colors.brand.accent : Colors.ui.textDim, textAlign: 'center', marginBottom: Spacing.xxl }}>
          {draft?.vatAmountNgn ? t('receipts.vatCreditAdded', { amount: draft.vatAmountNgn.toLocaleString('en-NG') }) : t('receipts.noVatOnReceipt')}
        </Text>
        <Pressable
          onPress={() => {
            setDraft(null);
            setOcrFailed(false);
            setPhase('camera');
          }}
          accessibilityRole="button"
          style={{ backgroundColor: Colors.brand.primary, borderRadius: Radii.lg, paddingVertical: 16, paddingHorizontal: Spacing.xxl }}
        >
          <Text style={{ color: Colors.ui.white, fontWeight: '700' }}>{t('receipts.scanAgain')}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} accessibilityRole="button" style={{ marginTop: Spacing.lg, paddingVertical: Spacing.md }}>
          <Text style={{ color: Colors.ui.textDim, ...Typography.body }}>{t('receipts.backToDashboard')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.ui.bg }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" ratio="4:3" />
      <View
        style={{
          position: 'absolute',
          top: '20%',
          left: '8%',
          right: '8%',
          height: '50%',
          borderColor: Colors.brand.primary,
          borderWidth: 2,
          borderRadius: Radii.lg,
          opacity: 0.7,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: '22%',
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          borderRadius: Radii.pill,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.sm,
        }}
      >
        <Text style={{ color: Colors.ui.white, ...Typography.caption }}>{t('receipts.alignFrame')}</Text>
      </View>
      <View style={{ position: 'absolute', bottom: Spacing.xxl, alignSelf: 'center' }}>
        <Pressable
          onPress={() => void handleCapture()}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={t('receipts.capture')}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: processing ? Colors.ui.textDim : Colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: Colors.ui.white,
          }}
        >
          {processing ? <ActivityIndicator color={Colors.ui.white} /> : <Text style={{ fontSize: 28 }}>📸</Text>}
        </Pressable>
      </View>
    </View>
  );
}
