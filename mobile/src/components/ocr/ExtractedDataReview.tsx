import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import * as Haptics from '../../utils/safeHaptics';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { Button } from '../Button';
import type { OCRResult } from '../../services/ocr';
import type { InvoiceItem } from '../../types/invoice';

interface ExtractedDataReviewProps {
  imageUri: string;
  extractedData: OCRResult;
  onAccept: (data: EditedData) => void;
  onRescan: () => void;
  onManualEntry: () => void;
}

export interface EditedData {
  vendor?: string;
  amount?: number;
  date?: string;
  items?: InvoiceItem[];
}

/**
 * ExtractedDataReview Component
 * 
 * Displays OCR-extracted receipt data with confidence indicators.
 * Allows users to edit low-confidence fields before accepting.
 */
export function ExtractedDataReview({
  imageUri,
  extractedData,
  onAccept,
  onRescan,
  onManualEntry,
}: ExtractedDataReviewProps) {
  const { t } = useTranslation();
  
  // Use overall confidence as fallback for all fields
  const fieldConfidence = extractedData.confidence;
  
  const [vendor, setVendor] = useState<string>(extractedData.vendor || '');
  const [amount, setAmount] = useState<string>(
    extractedData.amount?.toString() || ''
  );
  const [date, setDate] = useState<string>(extractedData.date || '');

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const editedData: EditedData = {
      vendor: vendor.trim() || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      date: date || undefined,
      items: extractedData.items,
    };
    
    onAccept(editedData);
  };

  const handleRescan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRescan();
  };

  const handleManualEntry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onManualEntry();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('ocr.reviewExtracted')}</Text>
        <Text style={styles.subtitle}>
          {t('ocr.tipLighting')}
        </Text>
      </View>

      {/* Scanned Receipt Preview */}
      <Image
        source={{ uri: imageUri }}
        style={styles.receiptPreview}
        resizeMode="contain"
      />

      {/* Confidence Indicator */}
      <View style={styles.confidenceContainer}>
        <Text style={styles.confidenceLabel}>{t('ocr.confidence')}</Text>
        <ConfidenceBadge confidence={fieldConfidence} />
      </View>

      {/* Extracted Fields */}
      <View style={styles.fieldsContainer}>
        {/* Vendor/Merchant */}
        {vendor !== undefined && (
          <FieldRow
            label={t('ocr.merchant')}
            value={vendor}
            confidence={fieldConfidence}
            onChangeText={setVendor}
            placeholder={t('ocr.placeholders.merchant')}
          />
        )}

        {/* Amount */}
        <FieldRow
          label={t('create.total')}
          value={amount}
          confidence={fieldConfidence}
          onChangeText={setAmount}
          placeholder={t('ocr.placeholders.amount')}
          keyboardType="decimal-pad"
          isLowConfidence={fieldConfidence < 0.7}
        />

        {/* Date */}
        {date && (
          <FieldRow
            label={t('ocr.receiptDate')}
            value={date}
            confidence={fieldConfidence}
            onChangeText={setDate}
            placeholder={t('ocr.placeholders.date')}
            isLowConfidence={fieldConfidence < 0.7}
          />
        )}

        {/* Items */}
        {extractedData.items && extractedData.items.length > 0 && (
          <View style={styles.itemsContainer}>
            <Text style={styles.itemsTitle}>
              {t('ocr.itemsFound', { count: extractedData.items.length })}
            </Text>
            {extractedData.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemDescription} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.itemAmount}>
                  ₦{item.unitPrice?.toFixed(2) || t('ocr.placeholders.amount')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label={t('ocr.useThisData')}
          onPress={handleAccept}
          variant="primary"
          fullWidth
        />
        
        <View style={styles.secondaryActions}>
          <Pressable style={styles.secondaryButton} onPress={handleRescan}>
            <Text style={styles.secondaryButtonText}>{t('ocr.retake')}</Text>
          </Pressable>
          
          <Pressable style={styles.secondaryButton} onPress={handleManualEntry}>
            <Text style={styles.secondaryButtonText}>{t('ocr.manualEntry')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * FieldRow Component - Editable field with confidence indicator
 */
interface FieldRowProps {
  label: string;
  value: string;
  confidence: number;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
  isLowConfidence?: boolean;
}

function FieldRow({
  label,
  value,
  confidence,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  isLowConfidence = false,
}: FieldRowProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <ConfidenceBadge confidence={confidence} />
      </View>
      
      <TextInput
        style={[
          styles.fieldInput,
          isLowConfidence && styles.lowConfidenceInput,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
      />
      
      {isLowConfidence && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            {t('ocr.lowConfidence')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * ConfidenceBadge Component
 */
interface ConfidenceBadgeProps {
  confidence: number;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { t } = useTranslation();
  
  const percentage = Math.round(confidence * 100);
  const variant = 
    confidence >= 0.9 ? 'excellent' :
    confidence >= 0.8 ? 'good' :
    confidence >= 0.7 ? 'acceptable' :
    'poor';
  
  const color =
    variant === 'excellent' ? colors.success :
    variant === 'good' ? colors.info :
    variant === 'acceptable' ? colors.warning :
    colors.error;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.badgeText, { color }]}>
        {t(`ocr.${variant}`)} ({percentage}%)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  
  // Header
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  
  // Receipt Preview
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  
  // Confidence
  confidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  confidenceLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  
  // Fields
  fieldsContainer: {
    gap: spacing.md,
  },
  fieldContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  fieldInput: {
    backgroundColor: colors.surfaceSlate,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  lowConfidenceInput: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  warningIcon: {
    fontSize: typography.size.sm,
  },
  warningText: {
    fontSize: typography.size.xs,
    color: colors.warning,
  },
  
  // Items
  itemsContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  itemsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  itemDescription: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  itemAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  
  // Badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  
  // Actions
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
});
