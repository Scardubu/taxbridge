---
name: taxbridge-mobile-excellence
description: Build production-excellent Nigerian fintech mobile applications with cultural authenticity, offline-first architecture, and tax compliance rigor. Use this skill when working on TaxBridge mobile app features, components, screens, or enhancements. Generates world-class React Native code that Nigerian SMEs trust with their business operations.
version: 1.0.0
platform: React Native (Expo)
target_audience: Nigerian Small-Medium Enterprises (SMEs)
compliance: NDPC, FIRS, NRS e-Invoicing, Peppol BIS Billing 3.0
---

# TaxBridge Mobile Excellence Skill

This skill guides the creation of production-excellent Nigerian fintech mobile applications, specifically for TaxBridge - an offline-first tax compliance and invoicing platform trusted by Nigerian SMEs.

## 🎯 Core Philosophy: Nigerian-First Design

TaxBridge is not a Western app localized for Nigeria - it's a **Nigerian app built from the ground up** for Nigerian business owners who:
- Operate in cash-heavy, offline-frequent environments
- Need tax compliance but find existing solutions complex or inaccessible
- Think in Naira, not abstract currencies
- Speak Nigerian English and Nigerian Pidgin, not formal British English
- Trust systems that explain reasoning, not black boxes
- Value transparency over sophistication

## 📐 Design System: Living Bridge Aesthetic

### Brand Identity
**Metaphor:** The "Living Bridge" - organic, natural, trustworthy infrastructure that grows stronger with use.

**Visual Language:**
- **Forest Green (#2D5F3F)**: Trust, growth, stability (primary)
- **Sunset Orange (#E17E2F)**: Energy, warmth, action (secondary)
- **River Blue (#4A90A4)**: Flow, clarity, progress (accent)
- **Earth tones**: Organic, grounded, authentic

**NOT:**
- Generic fintech blues/purples
- Corporate grays
- Sterile whites
- Western "SaaS aesthetic"

### Typography Hierarchy

**Headings:** Urbanist (Bold, SemiBold)
- Distinctive, modern, approachable
- Strong personality without being playful
- Works well in both English and Pidgin

**Body:** Inter (Regular, Medium)
- Exceptional readability at small sizes
- Professional but not corporate
- Excellent Nigerian Naira (₦) symbol rendering

**Never Use:**
- Arial, Helvetica, System fonts (too generic)
- Roboto (too Android-default)
- SF Pro (too iOS-default)

```typescript
// Design tokens (mobile/src/constants/tokens.ts)
export const typography = {
  h1: { fontFamily: 'Urbanist-Bold', fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: 'Urbanist-SemiBold', fontSize: 24, lineHeight: 32 },
  h3: { fontFamily: 'Urbanist-SemiBold', fontSize: 20, lineHeight: 28 },
  body: { fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: 'Inter-Medium', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20 },
  button: { fontFamily: 'Inter-Medium', fontSize: 16, lineHeight: 24 },
};
```

### Color System

```typescript
// Design tokens (mobile/src/constants/tokens.ts)
export const colors = {
  // Primary palette (Living Bridge)
  primary: '#2D5F3F',      // Forest Green - trust, stability
  primaryLight: '#3D7F5F',  // Lighter variant for hover states
  primaryDark: '#1D4F2F',   // Darker variant for pressed states
  
  // Secondary palette
  secondary: '#E17E2F',     // Sunset Orange - energy, action
  secondaryLight: '#F19E5F', // Lighter variant
  secondaryDark: '#C15E1F',  // Darker variant
  
  // Accent
  accent: '#4A90A4',        // River Blue - flow, clarity
  accentLight: '#6AA0B4',
  accentDark: '#2A7084',
  
  // Semantic colors
  success: '#27AE60',       // Growth green
  warning: '#F39C12',       // Caution yellow
  error: '#E74C3C',         // Alert red
  info: '#3498DB',          // Information blue
  
  // Neutrals (warm, organic)
  gray900: '#1A1A1A',       // Deep charcoal (not pure black)
  gray800: '#2D2D2D',
  gray700: '#4A4A4A',
  gray600: '#6B6B6B',
  gray500: '#8C8C8C',
  gray400: '#ADADAD',
  gray300: '#CECECE',
  gray200: '#E8E8E8',
  gray100: '#F5F5F5',
  white: '#FFFFFF',
  
  // Surfaces
  background: '#FAFAFA',    // Warm white, not sterile
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F5',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};
```

**Rules:**
1. **Never hardcode colors** - always use design tokens
2. **Use semantic names** - `colors.success` not `colors.green`
3. **Maintain 4.5:1 contrast ratio** for text (WCAG AA)
4. **Test in sunlight** - Nigerian users often use phones outdoors

### Spacing System

```typescript
export const spacing = {
  xs: 4,    // Tight spacing (icon padding, micro gaps)
  sm: 8,    // Small spacing (between related elements)
  md: 16,   // Default spacing (between components)
  lg: 24,   // Large spacing (between sections)
  xl: 32,   // Extra large (screen padding)
  xxl: 48,  // Screen headers, major sections
};
```

**Rules:**
1. **Use spacing tokens exclusively** - no magic numbers
2. **Touch targets ≥ 44x44 points** (Apple/Android accessibility)
3. **Generous padding on mobile** - phones held with thumbs
4. **Vertical rhythm** - consistent spacing creates visual harmony

## 🏗️ Architecture Patterns

### Offline-First Imperative

TaxBridge must work flawlessly without internet because:
- Nigerian internet is unreliable (network outages common)
- Users operate in areas with poor connectivity
- Business can't stop because network is down

**Implementation Pattern:**
```typescript
// ✅ GOOD: Optimistic UI with background sync
const createInvoice = async (invoiceData: InvoiceInput) => {
  // 1. Save locally FIRST (instant feedback)
  const localInvoice = await storage.saveInvoice({
    ...invoiceData,
    status: 'pending_sync',
    createdAt: new Date().toISOString(),
  });
  
  // 2. Show success immediately (optimistic)
  showToast({
    type: 'success',
    message: t('invoice.createdOffline'),
    haptic: 'success',
  });
  
  // 3. Sync in background (when online)
  syncQueue.enqueue({
    type: 'CREATE_INVOICE',
    payload: localInvoice,
    retryCount: 0,
  });
  
  return localInvoice;
};

// ❌ BAD: Blocks on network
const createInvoice = async (invoiceData: InvoiceInput) => {
  // User waits, sees loading spinner, gets error if offline
  const response = await api.post('/invoices', invoiceData);
  return response.data;
};
```

**Sync Strategy:**
```typescript
// Automatic sync triggers
useEffect(() => {
  // Sync when coming online
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && syncQueue.hasPending()) {
      syncQueue.processAll();
    }
  });
  
  // Periodic background sync (every 5 minutes when online)
  const interval = setInterval(() => {
    if (isOnline && syncQueue.hasPending()) {
      syncQueue.processAll();
    }
  }, 5 * 60 * 1000);
  
  return () => {
    unsubscribe();
    clearInterval(interval);
  };
}, []);
```

### Component Structure

**File Organization:**
```
mobile/src/
├── screens/              # Full-screen views
│   ├── DashboardScreen.tsx
│   ├── CreateInvoiceScreen.tsx
│   └── OnboardingScreen.tsx
├── components/
│   ├── ui/              # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── EmptyState.tsx
│   ├── invoice/         # Domain-specific
│   │   ├── InvoiceCard.tsx
│   │   ├── InvoiceWizard.tsx
│   │   └── InvoiceList.tsx
│   ├── tax/             # Tax-specific
│   │   ├── TaxBreakdownPanel.tsx
│   │   ├── TaxBracketVisualizer.tsx
│   │   └── VATCalculator.tsx
│   └── camera/          # OCR scanner
│       ├── CameraModal.tsx
│       └── ReceiptPreview.tsx
├── contexts/            # Global state
│   ├── AuthContext.tsx
│   ├── SyncContext.tsx
│   └── ThemeContext.tsx
├── hooks/               # Custom hooks
│   ├── useInvoices.ts
│   ├── useSync.ts
│   └── useCamera.ts
├── services/            # Business logic
│   ├── api.ts
│   ├── storage.ts
│   ├── analytics.ts
│   └── tax-calculator.ts
├── utils/               # Helpers
│   ├── validation.ts
│   ├── formatting.ts
│   └── currency.ts
└── constants/
    ├── tokens.ts        # Design tokens
    └── config.ts        # App config
```

**Component Template:**
```typescript
import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '@/constants/tokens';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress: (id: string) => void;
  showSyncStatus?: boolean;
}

export const InvoiceCard = memo<InvoiceCardProps>(({ 
  invoice, 
  onPress,
  showSyncStatus = true 
}) => {
  const { t } = useTranslation();
  
  // Memoize expensive calculations
  const totalAmount = useMemo(() => 
    formatCurrency(invoice.total, 'NGN'),
    [invoice.total]
  );
  
  // Memoize callbacks
  const handlePress = useCallback(() => {
    onPress(invoice.id);
  }, [invoice.id, onPress]);
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('invoice.cardLabel', { 
        customer: invoice.customerName,
        amount: totalAmount 
      })}
    >
      <View style={styles.header}>
        <Text style={styles.customerName}>{invoice.customerName}</Text>
        {showSyncStatus && (
          <SyncStatusBadge status={invoice.syncStatus} />
        )}
      </View>
      
      <View style={styles.details}>
        <Text style={styles.date}>
          {formatDate(invoice.createdAt, 'PPP')}
        </Text>
        <Text style={styles.amount}>{totalAmount}</Text>
      </View>
    </TouchableOpacity>
  );
});

InvoiceCard.displayName = 'InvoiceCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    // Shadow for depth (iOS)
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Elevation for depth (Android)
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  customerName: {
    ...typography.bodyMedium,
    color: colors.gray900,
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    ...typography.caption,
    color: colors.gray600,
  },
  amount: {
    ...typography.h3,
    color: colors.primary,
  },
});
```

### Performance Optimization

**Memoization Rules:**
```typescript
// ✅ ALWAYS memoize:
// 1. Expensive calculations
const taxBreakdown = useMemo(() => 
  calculateTax(invoice.items),
  [invoice.items]
);

// 2. Event handlers passed to children
const handleItemAdd = useCallback((item: InvoiceItem) => {
  setItems(prev => [...prev, item]);
}, []);

// 3. Pure functional components
export const StatusBadge = memo<StatusBadgeProps>(({ status }) => {
  // ...
});

// 4. Complex filters/sorts
const filteredInvoices = useMemo(() => 
  invoices
    .filter(inv => inv.status === filterStatus)
    .sort((a, b) => b.createdAt - a.createdAt),
  [invoices, filterStatus]
);
```

**List Rendering:**
```typescript
// ✅ GOOD: VirtualizedList for long lists
<FlatList
  data={invoices}
  renderItem={({ item }) => <InvoiceCard invoice={item} />}
  keyExtractor={item => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews={true}
  getItemLayout={(data, index) => ({
    length: INVOICE_CARD_HEIGHT,
    offset: INVOICE_CARD_HEIGHT * index,
    index,
  })}
/>

// ❌ BAD: map() on large arrays
{invoices.map(invoice => (
  <InvoiceCard key={invoice.id} invoice={invoice} />
))}
```

## 🌍 Cultural Authenticity

### Language Guidelines

**Nigerian English vs British/American English:**

| ❌ Generic English | ✅ Nigerian English |
|-------------------|-------------------|
| "Receipt" | "Receipt" (same) |
| "Invoice" | "Invoice" (same) |
| "Sync failed" | "Network wahala" |
| "Loading..." | "Dey load..." |
| "Try again" | "Try am again" |
| "Settings" | "Settings" |
| "Your invoices" | "Your invoices" |

**Nigerian Pidgin Integration:**
```typescript
// en.json (Nigerian English)
{
  "sync": {
    "pending": "Waiting to sync",
    "inProgress": "Syncing your data...",
    "failed": "Sync failed. Check your network.",
    "success": "All synced up!",
    "neverSynced": "Not synced yet"
  }
}

// pidgin.json (Nigerian Pidgin)
{
  "sync": {
    "pending": "Dey wait make e sync",
    "inProgress": "E dey sync your tins...",
    "failed": "Sync no work. Check your network.",
    "success": "Everything don sync!",
    "neverSynced": "Never sync before"
  }
}
```

**Rules:**
1. **No literal translations** - Pidgin is a distinct language
2. **Context matters** - "Wahala" means "problem" but feels different
3. **Test with Nigerians** - not just translation services
4. **Maintain parity** - every English key has Pidgin equivalent

### Currency Formatting

**Naira (₦) First:**
```typescript
// ✅ GOOD: Nigerian formatting
export const formatCurrency = (
  amount: number, 
  currency: 'NGN' = 'NGN'
): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Output: ₦15,000.00 (comma as thousands separator)
};

// ❌ BAD: Generic formatting
const formatted = `${currency} ${amount.toFixed(2)}`;
// Output: NGN 15000.00 (no separators, wrong symbol)
```

**Display Rules:**
1. **Always use ₦ symbol** (not "NGN" or "Naira")
2. **Comma separators** for thousands (₦1,000,000.00)
3. **Two decimal places** always shown (₦50.00 not ₦50)
4. **Right-align amounts** in tables/lists
5. **Large numbers** use compact notation (₦1.5M not ₦1,500,000.00)

### Tax Context Integration

**FIRS Compliance:**
```typescript
// VAT calculation (7.5% in Nigeria)
export const calculateVAT = (subtotal: number, taxable: boolean): number => {
  if (!taxable) return 0;
  return subtotal * 0.075; // 7.5% FIRS rate
};

// Withholding Tax (varies by service type)
export const calculateWHT = (
  amount: number, 
  serviceType: 'professional' | 'construction' | 'rental'
): number => {
  const rates = {
    professional: 0.05,  // 5% for professional services
    construction: 0.025, // 2.5% for construction
    rental: 0.10,        // 10% for rent
  };
  return amount * rates[serviceType];
};
```

**TIN (Tax Identification Number) Handling:**
```typescript
// Peppol BIS Billing 3.0 compliant
interface Customer {
  name: string;
  tin?: string; // Optional but encouraged
  endpointId?: string; // For NRS e-Invoicing
}

// Validate TIN format (Nigerian TIN: 12 digits or alphanumeric)
export const validateTIN = (tin: string): boolean => {
  const pattern = /^[A-Z0-9]{8,15}$/; // Nigerian TIN pattern
  return pattern.test(tin.replace(/[-\s]/g, ''));
};

// Format for UBL XML
export const formatTINForUBL = (tin: string): string => {
  return `<cac:PartyTaxScheme>
    <cbc:CompanyID schemeID="TIN">${tin}</cbc:CompanyID>
    <cac:TaxScheme>
      <cbc:ID>VAT</cbc:ID>
    </cac:TaxScheme>
  </cac:PartyTaxScheme>`;
};
```

## 🎨 Component Design Patterns

### Empty States

**Philosophy:** Empty states are onboarding opportunities, not dead ends.

```typescript
interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  illustration?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  illustration,
}) => {
  return (
    <View style={styles.container}>
      {illustration || (
        <Ionicons 
          name={icon} 
          size={64} 
          color={colors.gray400} 
        />
      )}
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      
      {action && (
        <TouchableOpacity 
          style={styles.button}
          onPress={action.onPress}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Usage
<EmptyState
  icon="receipt-outline"
  title={t('invoices.empty.title')}
  message={t('invoices.empty.message')}
  action={{
    label: t('invoices.empty.cta'),
    onPress: () => navigation.navigate('CreateInvoice'),
  }}
  illustration={<LottieAnimation source={require('@/assets/empty-invoices.json')} />}
/>
```

### Loading States

**Philosophy:** Users should always know what's happening and why.

```typescript
// ✅ GOOD: Contextual skeleton loaders
<SkeletonLoader type="invoice-card" count={3} />

// ❌ BAD: Generic spinner with no context
<ActivityIndicator size="large" />

// Implementation
interface SkeletonLoaderProps {
  type: 'invoice-card' | 'dashboard' | 'list-item';
  count?: number;
  animated?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type,
  count = 1,
  animated = true,
}) => {
  const Skeleton = skeletonComponents[type];
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} animated={animated} />
      ))}
    </>
  );
};

// Skeleton components
const InvoiceCardSkeleton = ({ animated }: { animated: boolean }) => (
  <View style={styles.card}>
    <SkeletonRect width="60%" height={20} animated={animated} />
    <SkeletonRect width="40%" height={16} animated={animated} />
    <SkeletonRect width="30%" height={24} animated={animated} />
  </View>
);
```

### Error States

**Philosophy:** Errors should guide users toward resolution, not frustration.

```typescript
interface ErrorStateProps {
  type: 'network' | 'validation' | 'sync' | 'permission';
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  dismissible?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type,
  message,
  action,
  dismissible = true,
}) => {
  const { icon, color } = errorConfig[type];
  
  return (
    <View style={[styles.container, { borderColor: color }]}>
      <Ionicons name={icon} size={48} color={color} />
      <Text style={styles.message}>{message}</Text>
      
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="primary"
        />
      )}
      
      {dismissible && (
        <TouchableOpacity style={styles.dismiss}>
          <Text style={styles.dismissText}>{t('common.dismiss')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Usage: Network error with retry
<ErrorState
  type="network"
  message={t('errors.networkFailed')}
  action={{
    label: t('common.retry'),
    onPress: () => refetch(),
  }}
/>

// Usage: Permission error with settings link
<ErrorState
  type="permission"
  message={t('errors.cameraPermission')}
  action={{
    label: t('common.openSettings'),
    onPress: () => Linking.openSettings(),
  }}
/>
```

### Toast Notifications

**Philosophy:** Toasts confirm actions without interrupting flow.

```typescript
interface ToastConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  duration?: number;
  haptic?: 'success' | 'warning' | 'error';
}

export const showToast = (config: ToastConfig) => {
  const { type, message, action, duration = 3000, haptic } = config;
  
  // Trigger haptic feedback
  if (haptic) {
    Haptics.notificationAsync(
      haptic === 'success' 
        ? Haptics.NotificationFeedbackType.Success
        : haptic === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning
    );
  }
  
  // Show toast UI
  Toast.show({
    type,
    text1: message,
    text2: action?.label,
    onPress: action?.onPress,
    visibilityTime: duration,
    position: 'bottom',
    bottomOffset: 100,
  });
};

// Usage: Success toast with action
showToast({
  type: 'success',
  message: t('invoice.created'),
  haptic: 'success',
  action: {
    label: t('common.view'),
    onPress: () => navigation.navigate('InvoiceDetail', { id }),
  },
});

// Usage: Error toast
showToast({
  type: 'error',
  message: t('sync.failed'),
  haptic: 'error',
  duration: 5000, // Longer for errors
});
```

## 🔐 Security & Compliance

### Input Validation

```typescript
// Customer name validation (letters, spaces, hyphens, apostrophes)
export const validateCustomerName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, error: t('validation.nameRequired') };
  }
  
  if (trimmed.length < 2) {
    return { valid: false, error: t('validation.nameTooShort') };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: t('validation.nameTooLong') };
  }
  
  // Allow letters, spaces, hyphens, apostrophes only
  const pattern = /^[a-zA-Z\s\-']+$/;
  if (!pattern.test(trimmed)) {
    return { valid: false, error: t('validation.nameInvalid') };
  }
  
  // Check for SQL injection patterns
  const sqlPatterns = /(--|;|\/\*|\*\/|xp_|sp_|union|select|insert|update|delete|drop)/i;
  if (sqlPatterns.test(trimmed)) {
    return { valid: false, error: t('validation.invalidCharacters') };
  }
  
  return { valid: true, value: trimmed };
};

// Amount validation
export const validateAmount = (amount: string): ValidationResult => {
  const parsed = parseFloat(amount);
  
  if (isNaN(parsed)) {
    return { valid: false, error: t('validation.amountInvalid') };
  }
  
  if (parsed < 0) {
    return { valid: false, error: t('validation.amountNegative') };
  }
  
  if (parsed > 999999999) {
    return { valid: false, error: t('validation.amountTooLarge') };
  }
  
  // Max 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    return { valid: false, error: t('validation.amountDecimals') };
  }
  
  return { valid: true, value: parsed };
};
```

### Data Privacy (NDPC Compliance)

```typescript
// Anonymize user data for analytics
export const anonymizeForAnalytics = (data: InvoiceData): AnalyticsEvent => {
  return {
    event: 'invoice_created',
    properties: {
      // Include: aggregate data, feature usage
      itemCount: data.items.length,
      totalAmount: Math.round(data.total / 1000) * 1000, // Rounded to nearest ₦1000
      hasVAT: data.vatAmount > 0,
      isOffline: !isConnected,
      
      // Exclude: PII, exact amounts, customer names
      // ❌ customerName: data.customerName,
      // ❌ customerTIN: data.customerTIN,
      // ❌ exactAmount: data.total,
    },
    timestamp: new Date().toISOString(),
  };
};

// Secure storage for sensitive data
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  // Store auth tokens securely
  async setToken(token: string) {
    await SecureStore.setItemAsync('auth_token', token);
  },
  
  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('auth_token');
  },
  
  async deleteToken() {
    await SecureStore.deleteItemAsync('auth_token');
  },
};
```

## 📱 Mobile-Specific Considerations

### Touch Interactions

```typescript
// ✅ GOOD: Generous touch targets
<TouchableOpacity 
  style={styles.button} // min 44x44 points
  onPress={handlePress}
  activeOpacity={0.7}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Text>Tap Me</Text>
</TouchableOpacity>

// ❌ BAD: Small touch targets
<TouchableOpacity style={{ width: 20, height: 20 }}>
  <Text style={{ fontSize: 10 }}>×</Text>
</TouchableOpacity>
```

### Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

// Success actions (invoice created, sync completed)
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Warning actions (low confidence OCR, offline mode)
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

// Error actions (sync failed, validation error)
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Selection changes (tab navigation, picker selection)
Haptics.selectionAsync();

// Light impact (button press, list item tap)
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

### Keyboard Handling

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

// ✅ GOOD: Keyboard-aware forms
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    <Input label="Customer Name" />
    <Input label="Amount" keyboardType="decimal-pad" />
  </ScrollView>
</KeyboardAvoidingView>
```

## 🧪 Testing Standards

### Unit Tests (Jest)

```typescript
// validation.test.ts
describe('validateCustomerName', () => {
  it('should accept valid names', () => {
    expect(validateCustomerName('John Doe').valid).toBe(true);
    expect(validateCustomerName("O'Brien").valid).toBe(true);
    expect(validateCustomerName('Mary-Jane').valid).toBe(true);
  });
  
  it('should reject empty names', () => {
    expect(validateCustomerName('').valid).toBe(false);
    expect(validateCustomerName('  ').valid).toBe(false);
  });
  
  it('should reject SQL injection attempts', () => {
    expect(validateCustomerName("'; DROP TABLE--").valid).toBe(false);
    expect(validateCustomerName('admin OR 1=1').valid).toBe(false);
  });
  
  it('should reject XSS attempts', () => {
    expect(validateCustomerName('<script>alert("xss")</script>').valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
// SyncContext.integration.test.tsx
describe('SyncContext - Manual Sync', () => {
  it('should sync pending invoices successfully', async () => {
    const { result } = renderHook(() => useSync(), {
      wrapper: SyncProvider,
    });
    
    // Add pending invoices
    await act(async () => {
      await storage.saveInvoice({ ...mockInvoice, status: 'pending_sync' });
    });
    
    // Trigger manual sync
    await act(async () => {
      await result.current.syncNow();
    });
    
    // Verify sync completed
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastSyncAt).toBeTruthy();
  });
});
```

### Visual Regression Tests

```typescript
// DashboardScreen.test.tsx
import { render } from '@testing-library/react-native';

describe('DashboardScreen', () => {
  it('should match snapshot', async () => {
    const { toJSON } = render(
      <TestProviders>
        <DashboardScreen />
      </TestProviders>
    );
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).toBeNull();
    });
    
    expect(toJSON()).toMatchSnapshot();
  });
});
```

## 📊 Analytics Integration

### Event Tracking

```typescript
// Track user actions (privacy-conscious)
export const trackEvent = (
  event: string, 
  properties?: Record<string, any>
) => {
  // Anonymize before sending
  const anonymized = {
    ...properties,
    userId: undefined, // Remove PII
    timestamp: new Date().toISOString(),
  };
  
  // Send to analytics (Sentry, PostHog, etc.)
  analytics.track(event, anonymized);
};

// Usage examples
trackEvent('onboarding_started');
trackEvent('onboarding_step_completed', { step: 2 });
trackEvent('invoice_created', { 
  itemCount: 3, 
  hasVAT: true, 
  offline: true 
});
trackEvent('ocr_scan_completed', { 
  confidence: 0.85, 
  fieldsExtracted: 5 
});
```

### Screen View Tracking

```typescript
// Track navigation
export const trackScreenView = (screenName: string) => {
  analytics.screen(screenName, {
    timestamp: new Date().toISOString(),
  });
};

// Auto-track in navigation
const navigationRef = useNavigationContainerRef();

useEffect(() => {
  const unsubscribe = navigationRef.addListener('state', () => {
    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute) {
      trackScreenView(currentRoute.name);
    }
  });
  
  return unsubscribe;
}, []);
```

## ✅ Pre-Deployment Checklist

Before marking any feature complete:

### Code Quality
- [ ] TypeScript: 0 errors (`npx tsc --noEmit`)
- [ ] ESLint: 0 errors (`npm run lint`)
- [ ] Tests: 100% passing (`npm test`)
- [ ] No `console.log` statements (use proper logging)
- [ ] No `any` types (use proper TypeScript types)

### Design Tokens
- [ ] No hardcoded colors (use `colors.*`)
- [ ] No hardcoded spacing (use `spacing.*`)
- [ ] No inline font styles (use `typography.*`)
- [ ] Consistent naming (semantic, not literal)

### Internationalization
- [ ] No hardcoded strings (use `t('key')`)
- [ ] All keys in both `en.json` and `pidgin.json`
- [ ] Pluralization handled (`t('key', { count })`)
- [ ] Currency/date formatting uses Nigerian formats

### Accessibility
- [ ] `accessibilityLabel` on all interactive elements
- [ ] `accessibilityHint` for non-obvious actions
- [ ] Touch targets ≥ 44x44 points
- [ ] Color contrast ≥ 4.5:1 (text)
- [ ] VoiceOver/TalkBack tested

### Performance
- [ ] Expensive calculations memoized (`useMemo`)
- [ ] Event handlers memoized (`useCallback`)
- [ ] Pure components memoized (`React.memo`)
- [ ] Lists virtualized (`FlatList`, not `.map()`)
- [ ] Images optimized (WebP, proper dimensions)

### Offline-First
- [ ] Works without internet (critical paths)
- [ ] Optimistic UI updates (instant feedback)
- [ ] Sync queue handles failures gracefully
- [ ] Network status visible to user

### Security
- [ ] Input validation (SQL injection, XSS)
- [ ] Sensitive data in SecureStore (not AsyncStorage)
- [ ] API calls use authentication tokens
- [ ] No PII in analytics events

### Analytics
- [ ] Key user actions tracked
- [ ] Screen views tracked
- [ ] Errors tracked (with context)
- [ ] Performance metrics captured

## 🚀 Deployment Process

### 1. Pre-Flight Checks
```bash
cd mobile

# Verify TypeScript compilation
npx tsc --noEmit

# Run full test suite
npm test -- --passWithNoTests --coverage

# Check bundle size
npx expo export --platform android
```

### 2. Build Production APK
```bash
cd mobile

# Preview build (for testing)
eas build --platform android --profile preview

# Production build (for Play Store)
eas build --platform android --profile production
```

### 3. Post-Deployment Monitoring
```bash
# Monitor Sentry for errors
# Check: https://sentry.io/organizations/taxbridge

# Verify analytics tracking
# Check: PostHog dashboard

# Monitor sync success rate
# Check: Admin dashboard
```

## 📚 Additional Resources

### Documentation
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Peppol BIS Billing 3.0](https://docs.peppol.eu/poacc/billing/3.0/)
- [FIRS Tax Guidelines](https://www.firs.gov.ng/)

### Design Inspiration
- Nigerian fintech: Paystack, Flutterwave, Kuda
- Offline-first: Linear, Notion, Obsidian
- Mobile-first: Instagram, WhatsApp, Telegram

### Testing Tools
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest](https://jestjs.io/)
- [Detox](https://wix.github.io/Detox/) (E2E testing)

---

## 🎯 Final Reminders

**Nigerian-First Design:**
- Build FOR Nigeria, not localize TO Nigeria
- Trust is earned through transparency, not sophistication
- Offline is not a fallback - it's the default

**Design System Discipline:**
- Design tokens are law, not suggestions
- Consistency builds trust
- Every exception needs justification

**Performance Matters:**
- Nigerian users often have budget phones
- Slow internet is reality, not edge case
- Battery life is precious

**Cultural Authenticity:**
- Nigerian English ≠ British English
- Pidgin is a language, not slang
- Naira formatting matters (₦1,000.00)

**Compliance is Non-Negotiable:**
- NDPC privacy requirements
- FIRS tax accuracy
- Peppol BIS standards
- Security best practices

---

**BUILD WITH EXCELLENCE. SHIP WITH CONFIDENCE.** 🚀