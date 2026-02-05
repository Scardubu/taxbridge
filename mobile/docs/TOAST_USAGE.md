# Toast System Usage Guide

The Toast system provides unified feedback messages across the TaxBridge mobile app.

## Features

- **4 Types**: Success, Error, Warning, Info
- **Haptic Feedback**: Optional vibration on display (iOS/Android)
- **Action Buttons**: Optional CTA within toast
- **Auto-Dismiss**: Configurable duration (default: 3 seconds)
- **Queue Management**: Multiple toasts display sequentially
- **i18n Support**: All messages support English + Pidgin translation

## Setup (Already Completed)

The `ToastProvider` is already integrated into `App.tsx` at the root level.

## Basic Usage

```tsx
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  const handleSave = async () => {
    try {
      await saveInvoice();
      
      // Success toast with haptic
      showToast({
        type: 'success',
        message: t('toast.invoiceSaved'),
        haptic: 'success',
      });
    } catch (error) {
      // Error toast with retry action
      showToast({
        type: 'error',
        message: t('toast.genericError'),
        haptic: 'error',
        action: {
          label: t('toast.retry'),
          onPress: handleSave,
        },
        duration: 5000, // Show longer for errors
      });
    }
  };
}
```

## Toast Types

### Success
```tsx
showToast({
  type: 'success',
  message: t('toast.invoiceSaved'),
  haptic: 'success',
});
```

### Error
```tsx
showToast({
  type: 'error',
  message: t('toast.syncFailed'),
  haptic: 'error',
  duration: 5000, // Show errors longer
});
```

### Warning
```tsx
showToast({
  type: 'warning',
  message: t('toast.networkOffline'),
  haptic: 'warning',
});
```

### Info
```tsx
showToast({
  type: 'info',
  message: t('toast.syncStarted'),
  // No haptic for info messages
});
```

## Common Use Cases

### 1. Invoice Operations
```tsx
// Save
showToast({
  type: 'success',
  message: t('toast.invoiceSaved'),
  haptic: 'success',
});

// Delete with undo
showToast({
  type: 'success',
  message: t('toast.invoiceDeleted'),
  action: {
    label: t('toast.undo'),
    onPress: handleUndo,
  },
  duration: 5000,
});
```

### 2. Network Status
```tsx
// Online
showToast({
  type: 'success',
  message: t('toast.networkOnline'),
});

// Offline
showToast({
  type: 'warning',
  message: t('toast.networkOffline'),
});
```

### 3. Sync Operations
```tsx
// Sync complete
showToast({
  type: 'success',
  message: t('toast.syncComplete'),
  haptic: 'success',
});

// Sync failed with retry
showToast({
  type: 'error',
  message: t('toast.syncFailed'),
  action: {
    label: t('toast.retry'),
    onPress: handleRetrySync,
  },
  duration: 5000,
});
```

### 4. OCR/Receipt Scanning
```tsx
// Success
showToast({
  type: 'success',
  message: t('toast.receiptScanned'),
  haptic: 'success',
});

// Error
showToast({
  type: 'error',
  message: t('toast.receiptFailed'),
  haptic: 'error',
});
```

### 5. Settings
```tsx
// Settings saved
showToast({
  type: 'success',
  message: t('toast.settingsSaved'),
  haptic: 'success',
});
```

### 6. Copy to Clipboard
```tsx
showToast({
  type: 'info',
  message: t('toast.copied'),
});
```

## Advanced Features

### Custom Duration
```tsx
showToast({
  type: 'error',
  message: 'Critical error occurred',
  duration: 10000, // Show for 10 seconds
});
```

### Persistent Toast (Manual Dismiss)
```tsx
showToast({
  type: 'warning',
  message: 'Action required',
  duration: 0, // Won't auto-dismiss
  action: {
    label: 'Fix Now',
    onPress: handleFix,
  },
});
```

### No Haptic Feedback
```tsx
showToast({
  type: 'info',
  message: 'Background sync started',
  // Omit 'haptic' prop - no vibration
});
```

## Available i18n Keys

```json
{
  "toast": {
    "invoiceSaved": "Invoice saved successfully",
    "invoiceDeleted": "Invoice deleted",
    "invoiceDraft": "Invoice saved as draft",
    "syncStarted": "Syncing in background",
    "syncComplete": "All invoices synced",
    "syncFailed": "Sync failed - will retry",
    "networkOnline": "Back online - syncing now",
    "networkOffline": "Offline mode - changes saved locally",
    "receiptScanned": "Receipt scanned successfully",
    "receiptFailed": "Could not scan receipt",
    "settingsSaved": "Settings updated",
    "settingsFailed": "Could not save settings",
    "copied": "Copied to clipboard",
    "genericError": "Something went wrong",
    "retry": "Retry",
    "undo": "Undo",
    "view": "View"
  }
}
```

## Design Tokens

The Toast system uses Living Bridge design tokens:

- **Success**: `colors.success` (Forest Green)
- **Error**: `colors.error` (Red)
- **Warning**: `colors.warning` (Sunset Orange)
- **Info**: `colors.info` (River Blue)
- **Background**: `colors.surface`
- **Border Radius**: `radii.lg`
- **Spacing**: `spacing.md`, `spacing.sm`, `spacing.xs`

## Best Practices

1. ✅ **Use i18n keys** for all messages (English + Pidgin)
2. ✅ **Add haptic feedback** for success/error/warning
3. ✅ **Show errors longer** (5+ seconds) with retry actions
4. ✅ **Keep messages short** (1-2 lines max)
5. ✅ **Use appropriate types** (don't use success for errors)
6. ❌ **Don't spam toasts** - queue system handles multiple, but avoid excessive display
7. ❌ **Don't use for critical alerts** - use Alert dialog for destructive actions
8. ❌ **Don't rely on toasts alone** - ensure state updates are reflected in UI

## Replacing Existing Alerts

### Before (Alert)
```tsx
Alert.alert('Success', 'Invoice saved successfully');
```

### After (Toast)
```tsx
showToast({
  type: 'success',
  message: t('toast.invoiceSaved'),
  haptic: 'success',
});
```

## Integration Checklist

- [x] ToastProvider added to App.tsx
- [x] Toast component created with 4 types
- [x] i18n keys added (en.json + pidgin.json)
- [ ] Replace Alert.alert calls with showToast
- [ ] Replace ActivityIndicator with SkeletonLoader
- [ ] Add toasts to sync operations
- [ ] Add toasts to invoice CRUD operations
- [ ] Add toasts to OCR scanning flow
- [ ] Add toasts to settings updates

## Next Steps

1. **Replace Alerts**: Search codebase for `Alert.alert` and replace with `showToast`
2. **Add to Sync**: Integrate toasts into SyncContext for feedback
3. **Add to OCR**: Show toasts after receipt scanning
4. **Add to Invoice**: Show toasts after save/delete operations
5. **Test Languages**: Verify English + Pidgin messages display correctly
