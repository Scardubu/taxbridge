import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { extractReceiptData, validateOCRResult, type OCRResult } from '../services/ocr';
import { useAuth } from '../contexts/AuthContext';
import { createExpense, type ExpenseCategory } from '../services/expenseApi';
import { getApiBaseUrl } from '../services/config';
import { colors, radii, spacing, typography } from '../theme/tokens';

export default function ScanReceiptScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showReviewMode, setShowReviewMode] = useState(false);

  // Editable fields for manual review
  const [editedVendor, setEditedVendor] = useState('');
  const [editedAmount, setEditedAmount] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedCategory, setEditedCategory] = useState<ExpenseCategory>('other');

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('scanReceipt.permissionRequired'), t('scanReceipt.permissionDesc'));
      return false;
    }
    return true;
  };

  const captureImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setIsProcessing(true);
    setOcrResult(null);
    setValidationWarnings([]);

    try {
      const apiBaseUrl = await getApiBaseUrl();

      const result = await extractReceiptData(uri, apiBaseUrl, {
        timeoutMs: 30000,
        maxRetries: 2,
      });

      setOcrResult(result);

      // Validate OCR result
      const validation = validateOCRResult(result, 0.7);
      
      if (!validation.isValid) {
        const warningMessages = validation.warnings.map(code => {
          switch (code) {
            case 'lowConfidence':
              return t('scanReceipt.lowConfidenceWarning', { percent: Math.round(result.confidence * 100) });
            case 'noAmountOrItems':
              return t('scanReceipt.noAmountOrItems');
            case 'invalidAmount':
              return t('scanReceipt.invalidAmount');
            case 'invalidDate':
              return t('scanReceipt.invalidDate');
            case 'unparseableDate':
              return t('scanReceipt.unparseableDate');
            default:
              return t('scanReceipt.unknownWarning');
          }
        });
        setValidationWarnings(warningMessages);
      }

      // Pre-fill editable fields
      setEditedVendor(result.vendor || '');
      setEditedAmount(result.amount?.toString() || '');
      setEditedDate(result.date || new Date().toISOString().split('T')[0]);
      
      // Auto-categorize based on vendor
      const category = categorizeVendor(result.vendor || '') as ExpenseCategory;
      setEditedCategory(category);

      // Show review mode if confidence is low or warnings exist
      if (result.confidence < 0.7 || validation.warnings.length > 0) {
        setShowReviewMode(true);
      }
    } catch (error) {
      if (__DEV__) console.error('OCR processing failed:', error);
      Alert.alert(
        t('scanReceipt.processingFailed'),
        t('scanReceipt.processingFailedDesc'),
        [
          { text: t('scanReceipt.retry'), onPress: () => processImage(uri) },
          { text: t('ocr.manualEntry'), onPress: () => setShowReviewMode(true) },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const categorizeVendor = (vendor: string): string => {
    const vendorLower = vendor.toLowerCase();
    
    if (vendorLower.includes('fuel') || vendorLower.includes('petrol') || vendorLower.includes('gas')) {
      return 'fuel';
    }
    if (vendorLower.includes('restaurant') || vendorLower.includes('food') || vendorLower.includes('cafe')) {
      return 'meals';
    }
    if (vendorLower.includes('office') || vendorLower.includes('stationery')) {
      return 'office-supplies';
    }
    if (vendorLower.includes('hotel') || vendorLower.includes('uber') || vendorLower.includes('taxi')) {
      return 'travel';
    }
    
    return 'other';
  };

  const saveExpense = async () => {
    if (!editedVendor || !editedAmount) {
      Alert.alert(t('scanReceipt.missingInfo'), t('scanReceipt.missingInfoDesc'));
      return;
    }

    try {
      await createExpense({
        businessId: '', // TODO: resolve from user context
        amount: parseFloat(editedAmount),
        category: editedCategory,
        description: editedVendor,
        date: editedDate,
        receiptImage: imageUri || undefined,
      });

      Alert.alert(t('scanReceipt.success'), t('scanReceipt.expenseSaved'), [
        { text: t('scanReceipt.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      if (__DEV__) console.error('Failed to save expense:', error);
      Alert.alert(t('scanReceipt.error'), t('scanReceipt.saveError'));
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#10B981'; // Green
    if (confidence >= 0.6) return '#F59E0B'; // Orange
    return '#DC2626'; // Red
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return t('scanReceipt.highConfidence');
    if (confidence >= 0.6) return t('scanReceipt.mediumConfidence');
    return t('scanReceipt.lowConfidence');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('scanReceipt.title')}</Text>
        <Text style={styles.subtitle}>{t('scanReceipt.subtitle')}</Text>
      </View>

      {!imageUri && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={captureImage}>
            <Ionicons name="camera" size={24} color="#FFF" />
            <Text style={styles.buttonText}>{t('scanReceipt.takePhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color="#16A34A" />
            <Text style={styles.secondaryButtonText}>{t('scanReceipt.chooseFromGallery')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} />
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => {
              setImageUri(null);
              setOcrResult(null);
              setShowReviewMode(false);
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retakeText}>{t('scanReceipt.retake')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.processingText}>{t('scanReceipt.processing')}</Text>
        </View>
      )}

      {ocrResult && !isProcessing && (
        <View style={styles.resultsContainer}>
          <View style={styles.confidenceBar}>
            <View style={styles.confidenceHeader}>
              <Text style={styles.confidenceLabel}>
                {getConfidenceLabel(ocrResult.confidence)}
              </Text>
              <Text style={styles.confidenceValue}>
                {Math.round(ocrResult.confidence * 100)}%
              </Text>
            </View>
            <View style={styles.confidenceBarTrack}>
              <View
                style={[
                  styles.confidenceBarFill,
                  {
                    width: `${ocrResult.confidence * 100}%`,
                    backgroundColor: getConfidenceColor(ocrResult.confidence),
                  },
                ]}
              />
            </View>
          </View>

          {validationWarnings.length > 0 && (
            <View style={styles.warningsContainer}>
              <View style={styles.warningHeader}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.warningTitle}>{t('scanReceipt.reviewNeeded')}</Text>
              </View>
              {validationWarnings.map((warning, index) => (
                <Text key={index} style={styles.warningText}>
                  • {warning}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.reviewButton}
                onPress={() => setShowReviewMode(true)}
              >
                <Text style={styles.reviewButtonText}>{t('scanReceipt.reviewAndEdit')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showReviewMode && validationWarnings.length === 0 && (
            <View style={styles.extractedData}>
              <Text style={styles.sectionTitle}>{t('scanReceipt.extractedData')}</Text>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{t('scanReceipt.vendor')}</Text>
                <Text style={styles.dataValue}>{ocrResult.vendor || t('scanReceipt.na')}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{t('scanReceipt.amount')}</Text>
                <Text style={styles.dataValue}>
                  ₦{ocrResult.amount?.toLocaleString() || t('scanReceipt.na')}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{t('scanReceipt.date')}</Text>
                <Text style={styles.dataValue}>{ocrResult.date || t('scanReceipt.na')}</Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveExpense}
              >
                <Text style={styles.saveButtonText}>{t('scanReceipt.saveExpense')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowReviewMode(true)}
              >
                <Text style={styles.editButtonText}>{t('scanReceipt.editDetails')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {showReviewMode && (
            <View style={styles.reviewContainer}>
              <Text style={styles.sectionTitle}>{t('scanReceipt.reviewAndEdit')}</Text>
              
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('scanReceipt.vendor')}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editedVendor}
                  onChangeText={setEditedVendor}
                  placeholder={t('scanReceipt.vendorPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  accessibilityLabel={t('scanReceipt.vendor')}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('scanReceipt.amount')}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editedAmount}
                  onChangeText={setEditedAmount}
                  placeholder={t('scanReceipt.amountPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('scanReceipt.amount')}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('scanReceipt.date')}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editedDate}
                  onChangeText={setEditedDate}
                  placeholder={t('scanReceipt.datePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  accessibilityLabel={t('scanReceipt.date')}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('scanReceipt.category')}</Text>
                <View style={styles.categoryRow}>
                  {(['fuel', 'meals', 'office-supplies', 'travel', 'other'] as const).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        editedCategory === cat && styles.categoryChipActive,
                      ]}
                      onPress={() => setEditedCategory(cat)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: editedCategory === cat }}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          editedCategory === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {t(`scanReceipt.categories.${cat}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveExpense}
              >
                <Text style={styles.saveButtonText}>{t('scanReceipt.saveExpense')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#16A34A',
    gap: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#16A34A',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    padding: 12,
    gap: 6,
  },
  retakeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  processingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  resultsContainer: {
    padding: 20,
    gap: 16,
  },
  confidenceBar: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  confidenceBarTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningsContainer: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  warningText: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 4,
  },
  reviewButton: {
    marginTop: 12,
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  extractedData: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dataLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#16A34A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  editButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
  },
  categoryChipActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
});
