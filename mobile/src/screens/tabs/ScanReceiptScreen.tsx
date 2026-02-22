/**
 * TaxBridge — Scan Receipt Screen
 * Camera capture → OCR → Review → Save as Expense
 * Confidence gating at 70%, validation warnings, offline queue
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, {
  FadeIn, FadeInDown, SlideInUp,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useScanReceipt, useCreateExpense } from '../../store/queries';
import {
  Button, Card, Badge, NairaInput, TextInputField,
  EmptyState,
} from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import type { OcrResult } from '../../api/client';

// ─── Nigerian Expense Categories (NTA 2025) ───────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Food & Beverage', 'Transportation', 'Office Supplies',
  'Utilities (PHCN/DSTV/Internet)', 'Professional Services',
  'Rent & Accommodation', 'Marketing & Advertising',
  'Equipment & Machinery', 'Raw Materials', 'Staff Welfare',
  'Government Levies & Taxes', 'Telecoms & Data', 'General Business Expenses',
] as const;

type ScanStep = 'camera' | 'processing' | 'review' | 'saved';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanReceiptScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [step, setStep]         = useState<ScanStep>('camera');
  const [ocrResult, setOcr]     = useState<OcrResult | null>(null);
  const [capturedUri, setCaptured] = useState<string | null>(null);

  // Editable fields (user can correct OCR errors)
  const [editAmount,   setEditAmount]   = useState(0);
  const [editVat,      setEditVat]      = useState(0);
  const [editVendor,   setEditVendor]   = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate,     setEditDate]     = useState('');
  const [editVatEl,    setEditVatEl]    = useState(false);

  const { mutateAsync: scanReceipt, isPending: isScanning } = useScanReceipt();
  const { mutateAsync: createExpense, isPending: isSaving }  = useCreateExpense();

  // ─── Pulsing capture indicator ────────────────────────────────────────────

  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(0.85, { duration: 800 }), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value,
  }));

  // ─── Camera capture ───────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:  0.7,
        base64:   false,
        exif:     false,
        skipProcessing: true,
      });

      // Resize to max 1024px wide to stay under 5MB OCR limit
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      setCaptured(resized.uri);
      setStep('processing');

      const result = await scanReceipt({
        base64:   resized.base64!,
        mimeType: 'image/jpeg',
      });

      // Pre-populate editable fields from OCR
      setOcr(result);
      setEditAmount(result.amount);
      setEditVat(result.vatAmount);
      setEditVendor(result.merchantName ?? '');
      setEditCategory(result.category ?? EXPENSE_CATEGORIES[12]);
      setEditDate(result.date ?? new Date().toISOString().split('T')[0]);
      setEditVatEl(result.vatEligible ?? false);
      setStep('review');

    } catch (err: any) {
      setStep('camera');
      Alert.alert(
        t('scan.noReceiptDetected'),
        err?.message ?? t('scan.tryAgain'),
        [{ text: t('common.retry'), onPress: () => {} }]
      );
    }
  }, [scanReceipt, t]);

  // ─── Save as expense ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!editAmount) {
      Alert.alert(t('common.error'), 'Please enter the expense amount');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      await createExpense({
        amount:      editAmount,
        vatAmount:   editVat || undefined,
        vatEligible: editVatEl,
        category:    editCategory || 'General Business Expenses',
        description: `Receipt — ${editVendor || 'Unknown Vendor'}`,
        vendorName:  editVendor || undefined,
        vendorTin:   ocrResult?.tinDetected || undefined,
        date:        editDate,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('saved');
      setTimeout(() => router.back(), 1800);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? 'Failed to save expense');
    }
  }, [editAmount, editVat, editVatEl, editCategory, editVendor, editDate, ocrResult, createExpense, t]);

  // ─── Permission guard ─────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.primary[500]} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <EmptyState
          emoji="📷"
          title={t('scan.cameraPermissionTitle') || 'Camera Permission Needed'}
          body="TaxBridge needs camera access to scan your receipts for expense tracking."
          action={{
            label: 'Allow Camera Access',
            onPress: requestPermission,
          }}
        />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Saved confirmation ───────────────────────────────────────────────────

  if (step === 'saved') {
    return (
      <View style={[styles.root, styles.centered]}>
        <Animated.View entering={FadeIn.springify()} style={styles.savedState}>
          <Text style={styles.savedEmoji}>✅</Text>
          <Text style={styles.savedTitle}>Expense Saved!</Text>
          <Text style={styles.savedBody}>
            ₦{editAmount.toLocaleString('en-NG')} added to your {editCategory}
          </Text>
        </Animated.View>
      </View>
    );
  }

  // ─── Processing state ─────────────────────────────────────────────────────

  if (step === 'processing') {
    return (
      <View style={[styles.root, styles.centered]}>
        <Animated.View entering={FadeIn} style={styles.processingState}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.processingText}>{t('scan.processing')}</Text>
          <Text style={styles.processingSubtext}>AI is reading your receipt...</Text>
        </Animated.View>
      </View>
    );
  }

  // ─── Review step ──────────────────────────────────────────────────────────

  if (step === 'review' && ocrResult) {
    const lowConfidence = ocrResult.confidence < 0.70;

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.reviewHeader}>
          <Pressable onPress={() => setStep('camera')} style={styles.headerBack}>
            <Text style={styles.headerBackText}>← {t('scan.retake')}</Text>
          </Pressable>
          <Text style={styles.reviewTitle}>{t('scan.reviewDetails')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.reviewScroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Confidence badge */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.confidenceRow}>
            <Badge
              label={`OCR: ${Math.round(ocrResult.confidence * 100)}% confidence`}
              variant={lowConfidence ? 'warning' : 'success'}
              dot
            />
            {ocrResult.tinDetected && (
              <Badge label={`TIN: ${ocrResult.tinDetected}`} variant="info" />
            )}
          </Animated.View>

          {/* Low confidence warning */}
          {lowConfidence && (
            <Animated.View entering={FadeIn} style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ {t('scan.lowConfidence')}
              </Text>
              <Text style={styles.warningBannerSub}>
                Review all fields before saving
              </Text>
            </Animated.View>
          )}

          {/* Validation warnings from OCR */}
          {ocrResult.validationWarnings.length > 0 && (
            <Card variant="warning" style={styles.warningsCard}>
              <Text style={styles.warningsTitle}>⚠️ {t('scan.warnings')}</Text>
              {ocrResult.validationWarnings.map((w, i) => (
                <Text key={i} style={styles.warningItem}>• {w}</Text>
              ))}
            </Card>
          )}

          {/* Editable fields */}
          <Text style={styles.reviewSection}>Extracted Details — Edit if Needed</Text>

          <TextInputField
            label={t('scan.vendor')}
            value={editVendor}
            onChangeText={setEditVendor}
            placeholder="Vendor / Merchant name"
            autoCapitalize="words"
          />

          <NairaInput
            label={t('scan.amount')}
            value={editAmount || undefined}
            onChangeText={setEditAmount}
            required
          />

          <NairaInput
            label="VAT Amount (₦)"
            value={editVat || undefined}
            onChangeText={setEditVat}
            hint="7.5% of expense amount if VAT-registered vendor"
          />

          <TextInputField
            label={t('scan.date')}
            value={editDate}
            onChangeText={setEditDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
          />

          {/* Category selector */}
          <Text style={styles.catLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                onPress={() => setEditCategory(cat)}
                style={[styles.catChip, editCategory === cat && styles.catChipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: editCategory === cat }}
              >
                <Text style={[styles.catChipText, editCategory === cat && styles.catChipTextSelected]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* VAT eligible toggle */}
          <Pressable
            style={styles.vatRow}
            onPress={() => setEditVatEl(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: editVatEl }}
          >
            <View style={[styles.checkbox, editVatEl && styles.checkboxOn]}>
              {editVatEl && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.vatLabel}>
              VAT Eligible — I can claim input tax on this expense
            </Text>
          </Pressable>

          <Button
            label={isSaving ? t('common.submitting') : t('scan.saveExpense')}
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving || !editAmount}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
          />
        </ScrollView>
      </View>
    );
  }

  // ─── Camera view ──────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash="auto"
      >
        {/* Top overlay */}
        <View style={[styles.cameraTop, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.closeCamera}>
            <Text style={styles.closeCameraText}>✕</Text>
          </Pressable>
          <Text style={styles.cameraTitle}>{t('scan.scanReceipt')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Receipt frame guide */}
        <View style={styles.frameGuide}>
          <View style={styles.frameCornerTL} />
          <View style={styles.frameCornerTR} />
          <View style={styles.frameCornerBL} />
          <View style={styles.frameCornerBR} />
        </View>

        {/* Instruction */}
        <Animated.View entering={FadeIn} style={styles.cameraHint}>
          <Text style={styles.cameraHintText}>{t('scan.pointCamera')}</Text>
          <Text style={styles.cameraHintSub}>
            Flat surface · Good lighting · Receipt fills frame
          </Text>
        </Animated.View>

        {/* Capture button */}
        <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 24 }]}>
          <Animated.View style={pulseStyle}>
            <Pressable
              onPress={handleCapture}
              disabled={isScanning}
              style={[styles.captureBtn, isScanning && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={t('scan.tapToCapture')}
            >
              <View style={styles.captureBtnInner} />
            </Pressable>
          </Animated.View>
          <Text style={styles.captureLabel}>{t('scan.tapToCapture')}</Text>
        </View>
      </CameraView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gray[50] },

  // Camera
  cameraTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeCamera: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeCameraText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  cameraTitle: {
    color: '#fff', fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },

  frameGuide: {
    flex: 1, margin: 48, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  frameCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.primary[400], borderTopLeftRadius: 4,
  },
  frameCornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.primary[400], borderTopRightRadius: 4,
  },
  frameCornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.primary[400], borderBottomLeftRadius: 4,
  },
  frameCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.primary[400], borderBottomRightRadius: 4,
  },

  cameraHint: {
    alignItems: 'center', paddingBottom: spacing[4],
    paddingHorizontal: spacing[5],
  },
  cameraHintText: {
    color: '#fff', fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  cameraHintSub: {
    color: 'rgba(255,255,255,0.7)', fontSize: typography.sizes.xs,
    textAlign: 'center', marginTop: 4,
  },

  cameraBottom: {
    alignItems: 'center', gap: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.4)', paddingTop: spacing[5],
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff',
  },
  captureLabel: { color: '#fff', fontSize: typography.sizes.xs, opacity: 0.8 },

  // Permission / states
  backBtn:     { marginTop: spacing[4] },
  backBtnText: { color: colors.primary[600], fontSize: typography.sizes.base },

  processingState: { alignItems: 'center', gap: spacing[4] },
  processingText: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  processingSubtext: { fontSize: typography.sizes.sm, color: colors.textMuted },

  savedState:  { alignItems: 'center', gap: spacing[3], padding: spacing[6] },
  savedEmoji:  { fontSize: 64 },
  savedTitle: {
    fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold,
    color: colors.primary[600],
  },
  savedBody:   { fontSize: typography.sizes.base, color: colors.textMuted, textAlign: 'center' },

  // Review
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: spacing[3],
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  reviewTitle: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  headerBack: { paddingVertical: spacing[1] },
  headerBackText: { color: colors.primary[600], fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  reviewScroll: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[3] },

  confidenceRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3], flexWrap: 'wrap' },

  warningBanner: {
    backgroundColor: colors.accent[100], borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.accent[300],
    padding: spacing[3], marginBottom: spacing[3],
  },
  warningBannerText: {
    color: colors.accent[700], fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  warningBannerSub: { color: colors.accent[600], fontSize: typography.sizes.xs, marginTop: 2 },

  warningsCard:  { marginBottom: spacing[3] },
  warningsTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.accent[700], marginBottom: spacing[1] },
  warningItem:   { fontSize: typography.sizes.xs, color: colors.accent[700], lineHeight: 18 },

  reviewSection: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing[3], marginTop: spacing[2],
  },

  catLabel: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium,
    color: colors.textSecondary, marginBottom: spacing[2],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  catRow: { paddingBottom: spacing[3], gap: spacing[2] },
  catChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  catChipSelected:     { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  catChipText:         { fontSize: typography.sizes.xs, color: colors.textMuted, whiteSpace: 'nowrap' as any },
  catChipTextSelected: { color: colors.primary[700], fontWeight: typography.weights.semibold },

  vatRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  vatLabel:  { fontSize: typography.sizes.sm, color: colors.textSecondary, flex: 1 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark:  { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
