# TaxBridge Mobile App

<div align="center">

**Offline-first invoice management for Nigerian SMEs**

[![Expo](https://img.shields.io/badge/Expo-54.x-blue)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)

</div>

---

## ✨ Features

### Core Functionality
- **Offline-First Architecture**: Create invoices without internet connection
- **SQLite Database**: Local storage with automatic sync when online
- **Real-time Sync**: Sync pending invoices to backend when connectivity is restored
- **Multi-language Support**: English and Nigerian Pidgin
- **Network Status Monitoring**: Real-time connection status indicators

### User Experience
- **Premium Animations**: Smooth transitions using React Native Reanimated
- **Form Validation**: Comprehensive validation with user-friendly error messages
- **Loading States**: Elegant loading overlays for async operations
- **Responsive Design**: Optimized for various screen sizes and devices
- **Accessibility**: WCAG compliant components with proper labeling

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Modular Architecture**: Clean separation of concerns with reusable components
- **Error Handling**: Graceful error handling with user feedback
- **Performance**: Optimized rendering and efficient data management

---

## 📁 Project Structure

```
mobile/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── AnimatedButton.tsx
│   │   ├── AnimatedStatusBadge.tsx
│   │   ├── InvoiceCard.tsx
│   │   ├── LoadingOverlay.tsx
│   │   └── NetworkStatus.tsx
│   ├── contexts/            # React contexts for global state
│   │   ├── LoadingContext.tsx
│   │   └── NetworkContext.tsx
│   ├── screens/             # Main application screens
│   │   ├── HomeScreen.tsx
│   │   ├── CreateInvoiceScreen.tsx
│   │   ├── InvoicesScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/            # Business logic and API calls
│   │   ├── api.ts           # Backend API integration
│   │   ├── database.ts      # SQLite operations
│   │   └── sync.ts          # Offline sync logic
│   ├── utils/               # Utility functions
│   │   └── validation.ts
│   ├── types/               # TypeScript type definitions
│   │   └── invoice.ts
│   └── i18n/                # Internationalization
│       ├── en.json          # English translations
│       ├── pidgin.json      # Nigerian Pidgin translations
│       └── index.ts
├── App.tsx                  # Main application entry point
├── babel.config.js          # Babel configuration
├── package.json             # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Scardubu/taxbridge.git
   cd taxbridge/mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   
   > **Note**: If you experience `fetch failed` or network-related failures on restricted networks, use:
   > ```bash
   > npm run start:no-doctor
   > ```
   > This sets `EXPO_NO_DOCTOR=1` to skip the dependency health check.

4. **Run on device/simulator**:
   ```bash
   # Android emulator
   npm run android
   
   # iOS simulator (macOS only)
   npm run ios
   
   # Web browser
   npm run web
   ```

---

## 🔌 Backend Integration

### API Configuration

The mobile app connects to the backend API. Default configuration:

| Environment | URL | Notes |
|-------------|-----|-------|
| Android Emulator | `http://10.0.2.2:3000` | Maps to host localhost |
| iOS Simulator | `http://localhost:3000` | Direct localhost access |
| Physical Device | `http://<your-ip>:3000` | Use network IP |
| Production | `https://api.taxbridge.ng` | Production server |

### Changing API URL

**Option 1: Settings Screen**
1. Open the app → Settings
2. Tap "API Server URL"
3. Enter your backend URL
4. Save changes

**Option 2: Programmatic**
```typescript
import { setApiBaseUrl } from './src/services/api';

// Set custom API URL
await setApiBaseUrl('http://192.168.1.100:3000');
```

### API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/invoices` | Create new invoice |
| `GET` | `/api/v1/invoices` | List invoices |
| `GET` | `/api/v1/invoices/:id` | Get invoice details |

### Request/Response Format

**Create Invoice**:
```typescript
// Request
POST /api/v1/invoices
{
  "customerName": "Aunty Ngozi",
  "items": [
    {
      "description": "Product A",
      "quantity": 2,
      "unitPrice": 500.00
    }
  ]
}

// Response
{
  "invoiceId": "uuid-string",
  "status": "queued"
}
```

---

## 📶 Offline Sync Flow

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Creates  │     │   Local SQLite  │     │   Backend API   │
│     Invoice     │────►│    Database     │────►│    (Online)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │  Pending  │◄── Network Offline
                        │   Queue   │
                        └─────┬─────┘
                              │
                              ▼ Network Online
                        ┌───────────┐
                        │   Auto    │
                        │   Sync    │
                        └───────────┘
```

### Sync Logic

1. **Invoice Creation** → Saved to SQLite with `synced: 0`
2. **Network Check** → Background monitoring via NetInfo
3. **Auto Sync** → When online, sync pending invoices
4. **Retry Logic** → Exponential backoff (max 5 attempts)
5. **Status Update** → Local record updated on success

### Sync Service (sync.ts)

```typescript
// Automatically syncs pending invoices
export async function syncPendingInvoices() {
  const pending = await getPendingInvoices();
  
  for (const invoice of pending) {
    try {
      await updateInvoiceStatus(invoice.id, 'processing');
      const result = await createInvoice(invoice);
      await markInvoiceSynced(invoice.id, result.invoiceId);
    } catch (error) {
      // Retry with exponential backoff
      await setInvoiceRetryMetadata(invoice.id, attempt, nextRetry);
    }
  }
}
```

---

## 🌍 Internationalization

### Supported Languages

| Code | Language | File |
|------|----------|------|
| `en` | English | `src/i18n/en.json` |
| `pidgin` | Nigerian Pidgin | `src/i18n/pidgin.json` |

### Usage

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <View>
      <Text>{t('home.title')}</Text>
      <Button onPress={() => i18n.changeLanguage('pidgin')}>
        {t('settings.language')}
      </Button>
    </View>
  );
}
```

### Adding Translations

1. Add key to `src/i18n/en.json`:
   ```json
   {
     "newFeature": {
       "title": "New Feature",
       "description": "This is a new feature"
     }
   }
   ```

2. Add Pidgin translation to `src/i18n/pidgin.json`:
   ```json
   {
     "newFeature": {
       "title": "New Feature",
       "description": "Dis na new feature"
     }
   }
   ```

---

## 🧪 Testing

TaxBridge mobile has **38 tests** across 4 test suites, all passing.

### Test Summary

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `SyncContext.test.tsx` | 1 | Offline sync context |
| `CreateInvoiceScreen.test.tsx` | 2 | Invoice creation flow |
| `payment.e2e.test.tsx` | 16 | Payment E2E flow |
| `e2e.test.tsx` | 19 | Core E2E integration |
| **Total** | **38** | ✅ All Passing |

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run specific test file
npm test -- payment.e2e.test.tsx
```

### Test Structure

```
mobile/
├── src/
│   └── __tests__/
│       ├── CreateInvoiceScreen.test.tsx  # Invoice form tests
│       ├── e2e.test.tsx                  # Core E2E integration tests
│       └── payment.e2e.test.tsx          # Payment flow E2E tests
├── __mocks__/
│   ├── expo-file-system.js               # Expo file system mock
│   └── expo-image-picker.js              # Image picker mock
├── jest.config.js                        # Jest configuration (npm workspaces)
└── jest.setup.js                         # Comprehensive RN mocking (~300 lines)
```

### Jest Configuration for npm Workspaces

This project uses npm workspaces monorepo structure. The mobile Jest configuration is specially configured to handle this:

```javascript
// jest.config.js - Key settings for npm workspaces
const rootNodeModules = path.resolve(__dirname, '../node_modules');

module.exports = {
  testEnvironment: 'jsdom',
  globals: { __DEV__: true },
  moduleDirectories: ['node_modules', rootNodeModules],
  // ... see jest.config.js for full configuration
};
```

### Mocking Strategy

The test infrastructure includes comprehensive mocks for React Native components and Expo modules:

- **React Native Core**: View, Text, TextInput, TouchableOpacity, Alert, etc.
- **Navigation**: @react-navigation/native, bottom-tabs
- **Expo Modules**: expo-sqlite, expo-file-system, expo-image-picker
- **Network**: @react-native-community/netinfo
- **Storage**: @react-native-async-storage/async-storage

### Test Categories

1. **Unit Tests**: Component rendering, form validation
2. **Integration Tests**: API mocking, context interactions
3. **E2E Tests**: Complete user flows (invoice creation, payment)

---

## 📱 Building for Production

### Android (APK/AAB)

```bash
# Build APK for testing
npx expo build:android -t apk

# Build AAB for Play Store
npx expo build:android -t app-bundle

# Using EAS Build (recommended)
npx eas build --platform android
```

### iOS

```bash
# Build for App Store
npx expo build:ios

# Using EAS Build (recommended)
npx eas build --platform ios
```

### Environment Configuration

Create `app.config.js` for environment-specific settings:

```javascript
export default {
  name: 'TaxBridge',
  slug: 'taxbridge',
  extra: {
    apiUrl: process.env.API_URL || 'https://api.taxbridge.ng',
    environment: process.env.NODE_ENV || 'production',
  },
};
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `fetch failed` on start | Use `npm run start:no-doctor` |
| Metro bundler crash | Clear cache: `npx expo start -c` |
| Android emulator not connecting | Use `http://10.0.2.2:3000` for API URL |
| iOS build failing | Ensure Xcode CLI tools installed |
| SQLite errors on web | Web uses AsyncStorage fallback |

### Debug Mode

```bash
# Enable React Native Debugger
npm start -- --dev-client

# View console logs
npx react-native log-android  # Android
npx react-native log-ios      # iOS
```

---

## ✅ Compliance

### Nigeria Tax Act 2025
- NRS e-Invoicing ready via DigiTax integration
- UBL 3.0 format support
- Offline capability for rural areas

### Data Protection (NDPR/NDPC)
- Local-first data storage
- Encrypted sensitive fields
- User data export capability

### Accessibility (WCAG)
- Screen reader support
- High contrast mode
- Semantic component structure
- Touch target sizing (44x44 minimum)

---

## 📞 Support

For technical support:
- **Documentation**: Check main [README](../README.md)
- **Issues**: Open a GitHub issue
- **Email**: support@taxbridge.ng

---

<div align="center">

**Built with ❤️ for Nigerian SMEs**

</div>
