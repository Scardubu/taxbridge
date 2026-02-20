import React, { useRef, useState, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OCRResult {
  merchantName: string;
  amount: number;
  date: string;
  vatAmount: number | null;
  category: string;
  items: { description: string; amount: number }[];
  confidence: number;
  validationWarnings: string[];
  rawText: string;
  engine: string;
}

type ScanPhase = 'idle' | 'scanning' | 'processing' | 'result' | 'error';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

// ─── Confidence helpers ──────────────────────────────────────────────────────

function getConfidenceTheme(confidence: number) {
  if (confidence >= 0.9) return { color: '#10B981', bg: '#D1FAE5', label: 'Excellent', emoji: '✅' };
  if (confidence >= 0.7) return { color: '#F59E0B', bg: '#FEF3C7', label: 'Review',    emoji: '⚠️' };
  return                        { color: '#EF4444', bg: '#FEE2E2', label: 'Low',        emoji: '❌' };
}

function getCategoryLabel(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Haptic feedback by confidence ──────────────────────────────────────────

async function fireConfidenceHaptic(confidence: number) {
  if (confidence >= 0.9) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (confidence >= 0.7) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } else {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

// ─── Animated confidence bar ─────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const theme = getConfidenceTheme(confidence);
  const width = useRef(new Animated.Value(0)).current;
  const pct = Math.round(confidence * 100);

  React.useEffect(() => {
    Animated.spring(width, {
      toValue: confidence,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  }, [confidence]);

  return (
    <View style={cbStyles.container}>
      <View style={cbStyles.row}>
        <Text style={cbStyles.label}>OCR Confidence</Text>
        <View style={[cbStyles.badge, { backgroundColor: theme.bg }]}>
          <Text style={[cbStyles.badgeText, { color: theme.color }]}>
            {theme.emoji} {theme.label} — {pct}%
          </Text>
        </View>
      </View>
      <View style={cbStyles.track}>
        <Animated.View
          style={[
            cbStyles.fill,
            {
              backgroundColor: theme.color,
              width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      {confidence < 0.7 && (
        <Text style={cbStyles.hint}>
          Low confidence — consider entering details manually or retaking the photo
        </Text>
      )}
    </View>
  );
}

const cbStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  track: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  hint: { fontSize: 12, color: '#EF4444', marginTop: 6, lineHeight: 17 },
});

// ─── Result card ─────────────────────────────────────────────────────────────

function ResultCard({
  result,
  onAccept,
  onRetry,
}: {
  result: OCRResult;
  onAccept: () => void;
  onRetry: () => void;
}) {
  const theme = getConfidenceTheme(result.confidence);

  return (
    <View style={rcStyles.card}>
      <Text style={rcStyles.title}>📄 Scanned Receipt</Text>

      <ConfidenceBar confidence={result.confidence} />

      <View style={rcStyles.grid}>
        <View style={rcStyles.field}>
          <Text style={rcStyles.fieldLabel}>Merchant</Text>
          <Text style={rcStyles.fieldValue}>{result.merchantName}</Text>
        </View>
        <View style={rcStyles.field}>
          <Text style={rcStyles.fieldLabel}>Category</Text>
          <Text style={rcStyles.fieldValue}>{getCategoryLabel(result.category)}</Text>
        </View>
        <View style={rcStyles.field}>
          <Text style={rcStyles.fieldLabel}>Amount</Text>
          <Text style={[rcStyles.fieldValue, rcStyles.amount]}>
            ₦{result.amount.toLocaleString('en-NG')}
          </Text>
        </View>
        <View style={rcStyles.field}>
          <Text style={rcStyles.fieldLabel}>Date</Text>
          <Text style={rcStyles.fieldValue}>{result.date}</Text>
        </View>
        {result.vatAmount != null && (
          <View style={rcStyles.field}>
            <Text style={rcStyles.fieldLabel}>VAT</Text>
            <Text style={rcStyles.fieldValue}>₦{result.vatAmount.toLocaleString('en-NG')}</Text>
          </View>
        )}
        <View style={rcStyles.field}>
          <Text style={rcStyles.fieldLabel}>Engine</Text>
          <Text style={[rcStyles.fieldValue, { color: '#94A3B8', fontSize: 11 }]}>
            {result.engine}
          </Text>
        </View>
      </View>

      {result.validationWarnings.length > 0 && (
        <View style={rcStyles.warnings}>
          {result.validationWarnings.map((w, i) => (
            <Text key={i} style={rcStyles.warningText}>⚠️ {w}</Text>
          ))}
        </View>
      )}

      {result.items.length > 0 && (
        <View style={rcStyles.items}>
          <Text style={rcStyles.itemsTitle}>Line Items</Text>
          {result.items.slice(0, 5).map((item, i) => (
            <View key={i} style={rcStyles.itemRow}>
              <Text style={rcStyles.itemDesc} numberOfLines={1}>{item.description}</Text>
              <Text style={rcStyles.itemAmount}>₦{item.amount.toLocaleString('en-NG')}</Text>
            </View>
          ))}
          {result.items.length > 5 && (
            <Text style={rcStyles.moreItems}>+{result.items.length - 5} more items</Text>
          )}
        </View>
      )}

      <View style={rcStyles.actions}>
        <TouchableOpacity
          style={rcStyles.retryBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRetry();
          }}
        >
          <Text style={rcStyles.retryText}>↩ Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rcStyles.acceptBtn, { backgroundColor: theme.color }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAccept();
          }}
        >
          <Text style={rcStyles.acceptText}>Use This Receipt ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  field: { width: '47%' },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  amount: { fontSize: 20, color: '#059669' },
  warnings: { backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, marginBottom: 12, gap: 4 },
  warningText: { fontSize: 12, color: '#D97706', lineHeight: 18 },
  items: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginBottom: 16 },
  itemsTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemDesc: { flex: 1, fontSize: 13, color: '#475569', marginRight: 8 },
  itemAmount: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  moreItems: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  retryBtn: { flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  retryText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  acceptBtn: { flex: 2, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  acceptText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ScanReceiptScreen({
  onResult,
}: {
  onResult?: (result: OCRResult) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const processImage = useCallback(async (base64: string) => {
    setPhase('processing');
    try {
      const res = await fetch(`${API}/api/v1/ocr/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, imageType: 'base64' }),
      });

      if (!res.ok) throw new Error(`OCR service error: ${res.status}`);

      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'OCR failed');

      const ocrResult: OCRResult = json.data;

      // Fire haptic based on confidence
      await fireConfidenceHaptic(ocrResult.confidence);

      setResult(ocrResult);
      setPhase('result');
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Failed to process receipt');
      setPhase('error');
    }
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('scanning');

    const photo = await cameraRef.current.takePictureAsync({
      base64: true,
      quality: 0.85,
      exif: false,
    });

    if (photo?.base64) {
      await processImage(photo.base64);
    } else {
      setError('Failed to capture photo');
      setPhase('error');
    }
  };

  const pickFromGallery = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.85,
    });

    if (!picked.canceled && picked.assets[0]?.base64) {
      await processImage(picked.assets[0].base64);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>
          TaxBridge needs camera access to scan receipts with AI-powered OCR
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'result' && result) {
    return (
      <ResultCard
        result={result}
        onAccept={() => {
          onResult?.(result);
          setPhase('idle');
          setResult(null);
        }}
        onRetry={() => {
          setPhase('idle');
          setResult(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Viewfinder overlay */}
        <View style={styles.overlay}>
          <View style={styles.viewfinder}>
            {/* Corner brackets */}
            {[['tl', 0, 0], ['tr', 0, undefined], ['bl', undefined, 0], ['br', undefined, undefined]].map(
              ([key, top, left]) => (
                <View
                  key={key as string}
                  style={[
                    styles.corner,
                    top !== undefined ? { top: 0 } : { bottom: 0 },
                    left !== undefined ? { left: 0 } : { right: 0 },
                    top === undefined && left === undefined
                      ? styles.cornerBR
                      : top === undefined
                      ? styles.cornerBL
                      : left === undefined
                      ? styles.cornerTR
                      : styles.cornerTL,
                  ]}
                />
              )
            )}
          </View>

          {phase === 'processing' && (
            <View style={styles.processingBadge}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.processingText}>Extracting data with AI…</Text>
            </View>
          )}

          {phase === 'error' && (
            <View style={styles.errorBadge}>
              <Text style={styles.errorBadgeText}>❌ {error}</Text>
              <TouchableOpacity onPress={() => { setPhase('idle'); setError(null); }}>
                <Text style={styles.errorRetry}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.hint}>
            <Text style={styles.hintText}>📄 Align receipt within frame</Text>
          </View>
        </View>
      </CameraView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Text style={styles.galleryIcon}>🖼</Text>
          <Text style={styles.galleryLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, phase === 'processing' && styles.captureBtnDisabled]}
          onPress={takePicture}
          disabled={phase === 'processing'}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>

        <View style={{ width: 64 }} />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    width: 280, height: 180, position: 'relative',
    borderRadius: 4,
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: '#10B981', borderWidth: 3,
  },
  cornerTL: { borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  processingBadge: {
    position: 'absolute', bottom: -60, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99,
  },
  processingText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  errorBadge: {
    position: 'absolute', bottom: -80, alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.85)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  errorBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  errorRetry: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  hint: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? -130 : -110,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
  },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingVertical: 24, backgroundColor: '#000',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  galleryBtn: { width: 64, alignItems: 'center', gap: 4 },
  galleryIcon: { fontSize: 28 },
  galleryLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  captureBtnDisabled: { opacity: 0.4 },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  permSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  permBtn: { backgroundColor: '#10B981', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
