---
trigger: always_on
---

# 📱 TAXBRIDGE MOBILE APP IMPLEMENTATION GUIDE
## React Native + Expo Offline-First Architecture

---

## 📋 OVERVIEW

The TaxBridge mobile app is built with:
- **React Native** with Expo for cross-platform development
- **SQLite** for offline-first data storage
- **Reanimated 2** for smooth animations
- **React Navigation** for navigation
- **Expo modules** for native functionality

---

## 🏗️ PROJECT STRUCTURE

```
mobile/
├── app.json
├── package.json
├── tsconfig.json
├── metro.config.js
├── src/
│   ├── App.tsx
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── types.ts
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── OnboardingScreen.tsx
│   │   ├── Dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   ├── Invoice/
│   │   │   ├── InvoiceListScreen.tsx
│   │   │   ├── InvoiceDetailScreen.tsx
│   │   │   └── CreateInvoiceScreen.tsx
│   │   ├── Expense/
│   │   │   ├── ExpenseListScreen.tsx
│   │   │   └── ScanReceiptScreen.tsx
│   │   ├── Tax/
│   │   │   └── TaxCalculatorScreen.tsx
│   │   └── Settings/
│   │       └── SettingsScreen.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   ├── InvoiceCard.tsx
│   │   ├── ExpenseCard.tsx
│   │   └── TaxBreakdown.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── SyncContext.tsx
│   │   └── ThemeContext.tsx
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── invoices.ts
│   │   │   ├── payments.ts
│   │   │   └── tax.ts
│   │   ├── sqlite/
│   │   │   ├── database.ts
│   │   │   ├── invoices.ts
│   │   │   ├── expenses.ts
│   │   │   └── sync-queue.ts
│   │   └── ocr/
│   │       └── receipt-scanner.ts
│   ├── tax/
│   │   └── engine.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── logger.ts
│   ├── hooks/
│   │   ├── useInvoices.ts
│   │   ├── useExpenses.ts
│   │   └── useSync.ts
│   ├── types/
│   │   └── index.ts
│   └── constants/
│       └── tokens.ts
└── assets/
    ├── images/
    └── fonts/
```

---

## 🎨 DESIGN TOKENS

**File**: `src/constants/tokens.ts`
```typescript
export const tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
    xxxxl: 64,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  colors: {
    primary: '#16A34A',
    primaryLight: '#22C55E',
    primaryDark: '#15803D',
    secondary: '#0EA5E9',
    secondaryLight: '#38BDF8',
    secondaryDark: '#0284C7',
    danger: '#DC2626',
    warning: '#F59E0B',
    success: '#10B981',
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    white: '#FFFFFF',
    black: '#000000',
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 38,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};
```

---

## 🗄️ SQLITE DATABASE SETUP

**File**: `src/services/sqlite/database.ts`
```typescript
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'taxbridge.db';

export const db = SQLite.openDatabase(DB_NAME);

/**
 * Initialize database tables
 */
export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      // Invoices table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          business_id TEXT NOT NULL,
          customer TEXT NOT NULL,
          items TEXT NOT NULL,
          subtotal REAL NOT NULL,
          vat_amount REAL NOT NULL,
          total REAL NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL,
          nrs_compliant INTEGER DEFAULT 0,
          firs_irn TEXT,
          qr_code TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        [],
        () => console.log('Invoices table created'),
        (_, error) => {
          console.error('Error creating invoices table', error);
          return false;
        }
      );

      // Expenses table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          date TEXT NOT NULL,
          vat_amount REAL DEFAULT 0,
          vat_eligible INTEGER DEFAULT 0,
          receipt_image TEXT,
          ocr_data TEXT,
          status TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        [],
        () => console.log('Expenses table created'),
        (_, error) => {
          console.error('Error creating expenses table', error);
          return false;
        }
      );

      // Sync queue table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_type TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          retry_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending'
        )`,
        [],
        () => console.log('Sync queue table created'),
        (_, error) => {
          console.error('Error creating sync queue table', error);
          return false;
        }
      );

      // Payments table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          amount REAL NOT NULL,
          gateway TEXT NOT NULL,
          reference TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          paid_at TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )`,
        [],
        () => console.log('Payments table created'),
        (_, error) => {
          console.error('Error creating payments table', error);
          return false;
        }
      );
    }, reject, resolve);
  });
};

/**
 * Clear all data (for logout or reset)
 */
export const clearDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('DELETE FROM invoices');
      tx.executeSql('DELETE FROM expenses');
      tx.executeSql('DELETE FROM sync_queue');
      tx.executeSql('DELETE FROM payments');
    }, reject, resolve);
  });
};
```

---

## 🔄 SYNC CONTEXT

**File**: `src/contexts/SyncContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { db } from '@/services/sqlite/database';
import { syncService } from '@/services/api/sync';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  queueOperation: (operation: SyncOperation) => Promise<void>;
  syncNow: () => Promise<void>;
  pendingCount: number;
}

interface SyncOperation {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  recordId: string;
  data: any;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
      
      // Trigger sync when coming back online
      if (state.isConnected && !isSyncing) {
        syncNow();
      }
    });

    return unsubscribe;
  }, [isSyncing]);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
        ['pending'],
        (_, result) => {
          setPendingCount(result.rows.item(0).count);
        }
      );
    });
  }, []);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  /**
   * Queue an operation for syncing
   */
  const queueOperation = useCallback(async (operation: SyncOperation): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO sync_queue (operation_type, table_name, record_id, data, timestamp, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            operation.type,
            operation.table,
            operation.recordId,
            JSON.stringify(operation.data),
            Date.now(),
            'pending',
          ],
          () => {
            updatePendingCount();
            
            // Trigger sync if online
            if (isOnline && !isSyncing) {
              syncNow().catch(console.error);
            }
            
            resolve();
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }, [isOnline, isSyncing, updatePendingCount]);

  /**
   * Sync pending operations
   */
  const syncNow = useCallback(async (): Promise<void> => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);

    try {
      // Get pending operations
      const operations = await new Promise<any[]>((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            'SELECT * FROM sync_queue WHERE status = ? ORDER BY timestamp ASC LIMIT 10',
            ['pending'],
            (_, result) => {
              const ops = [];
              for (let i = 0; i < result.rows.length; i++) {
                ops.push(result.rows.item(i));
              }
              resolve(ops);
            },
            (_, error) => {
              reject(error);
              return false;
            }
          );
        });
      });

      // Process each operation
      for (const op of operations) {
        try {
          const data = JSON.parse(op.data);
          
          // Send to server
          await syncService.processOperation({
            type: op.operation_type,
            table: op.table_name,
            recordId: op.record_id,
            data,
          });

          // Mark as synced
          await new Promise<void>((resolve, reject) => {
            db.transaction((tx) => {
              tx.executeSql(
                'UPDATE sync_queue SET status = ? WHERE id = ?',
                ['synced', op.id],
                () => resolve(),
                (_, error) => {
                  reject(error);
                  return false;
                }
              );
            });
          });

          // Update the main record
          await new Promise<void>((resolve, reject) => {
            db.transaction((tx) => {
              tx.executeSql(
                `UPDATE ${op.table_name} SET synced = 1 WHERE id = ?`,
                [op.record_id],
                () => resolve(),
                (_, error) => {
                  reject(error);
                  return false;
                }
              );
            });
          });

        } catch (error) {
          console.error('Error syncing operation', error);
          
          // Increment retry count
          await new Promise<void>((resolve, reject) => {
            db.transaction((tx) => {
              tx.executeSql(
                'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
                [op.id],
                () => resolve(),
                (_, error) => {
                  reject(error);
                  return false;
                }
              );
            });
          });
        }
      }

      updatePendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        queueOperation,
        syncNow,
        pendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
};
```

---

## 📄 CREATE INVOICE SCREEN

**File**: `src/screens/Invoice/CreateInvoiceScreen.tsx`
```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSyncContext } from '@/contexts/SyncContext';
import { db } from '@/services/sqlite/database';
import { tokens } from '@/constants/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatApplicable: boolean;
}

export const CreateInvoiceScreen = () => {
  const navigation = useNavigation();
  const { queueOperation } = useSyncContext();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatApplicable: true },
  ]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      { description: '', quantity: 1, unitPrice: 0, vatApplicable: true },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let vatAmount = 0;

    items.forEach((item) => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;
      if (item.vatApplicable) {
        vatAmount += itemTotal * 0.075;
      }
    });

    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
    };
  };

  const handleSubmit = async () => {
    // Validation
    if (!customerName || !customerEmail) {
      Alert.alert('Error', 'Please fill in customer details');
      return;
    }

    if (items.some((item) => !item.description || item.unitPrice <= 0)) {
      Alert.alert('Error', 'Please fill in all item details');
      return;
    }

    setLoading(true);

    try {
      const { subtotal, vatAmount, total } = calculateTotals();
      const invoiceId = `inv_${Date.now()}`;
      const invoiceNumber = `INV/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;

      const invoiceData = {
        id: invoiceId,
        invoiceNumber,
        businessId: 'current_business_id', // Get from auth context
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        items: items.map((item) => ({
          ...item,
          total: item.quantity * item.unitPrice,
          vatAmount: item.vatApplicable ? item.quantity * item.unitPrice * 0.075 : 0,
        })),
        subtotal,
        vatAmount,
        total,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'DRAFT',
        nrsCompliant: false,
        synced: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to SQLite
      await new Promise<void>((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            `INSERT INTO invoices (
              id, invoice_number, business_id, customer, items,
              subtotal, vat_amount, total, due_date, status,
              nrs_compliant, synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invoiceData.id,
              invoiceData.invoiceNumber,
              invoiceData.businessId,
              JSON.stringify(invoiceData.customer),
              JSON.stringify(invoiceData.items),
              invoiceData.subtotal,
              invoiceData.vatAmount,
              invoiceData.total,
              invoiceData.dueDate,
              invoiceData.status,
              invoiceData.nrsCompliant ? 1 : 0,
              0,
              invoiceData.createdAt,
              invoiceData.updatedAt,
            ],
            () => resolve(),
            (_, error) => {
              reject(error);
              return false;
            }
          );
        });
      });

      // Queue for syncing
      await queueOperation({
        type: 'CREATE',
        table: 'invoices',
        recordId: invoiceId,
        data: invoiceData,
      });

      Alert.alert('Success', 'Invoice created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating invoice', error);
      Alert.alert('Error', 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vatAmount, total } = calculateTotals();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        
        <Input
          label="Customer Name"
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Enter customer name"
        />
        
        <Input
          label="Email"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          placeholder="customer@example.com"
          keyboardType="email-address"
        />
        
        <Input
          label="Phone (Optional)"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder="+234 xxx xxx xxxx"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Items</Text>
          <TouchableOpacity onPress={addItem}>
            <Text style={styles.addButton}>+ Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={index} style={styles.itemContainer}>
            <Input
              label="Description"
              value={item.description}
              onChangeText={(text) => updateItem(index, 'description', text)}
              placeholder="Item description"
            />
            
            <View style={styles.row}>
              <Input
                label="Quantity"
                value={String(item.quantity)}
                onChangeText={(text) => updateItem(index, 'quantity', Number(text))}
                keyboardType="numeric"
                style={styles.halfInput}
              />
              
              <Input
                label="Unit Price (₦)"
                value={String(item.unitPrice)}
                onChangeText={(text) => updateItem(index, 'unitPrice', Number(text))}
                keyboardType="numeric"
                style={styles.halfInput}
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>VAT Applicable</Text>
              <TouchableOpacity
                onPress={() => updateItem(index, 'vatApplicable', !item.vatApplicable)}
                style={styles.checkbox}
              >
                <Text>{item.vatApplicable ? '☑' : '☐'}</Text>
              </TouchableOpacity>
            </View>

            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItem(index)}>
                <Text style={styles.removeButton}>Remove Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totals</Text>
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>₦{subtotal.toLocaleString()}</Text>
        </View>
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT (7.5%):</Text>
          <Text style={styles.totalValue}>₦{vatAmount.toLocaleString()}</Text>
        </View>
        
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total:</Text>
          <Text style={styles.grandTotalValue}>₦{total.toLocaleString()}</Text>
        </View>
      </View>

      <Button
        title="Create Invoice"
        onPress={handleSubmit}
        loading={loading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing.lg,
  },
  section: {
    marginBottom: tokens.spacing.xl,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    ...tokens.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    ...tokens.typography.h3,
    color: tokens.colors.neutral[900],
  },
  addButton: {
    color: tokens.colors.primary,
    ...tokens.typography.body,
    fontWeight: '600',
  },
  itemContainer: {
    marginBottom: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  halfInput: {
    flex: 0.48,
  },
  label: {
    ...tokens.typography.body,
    color: tokens.colors.neutral[700],
  },
  checkbox: {
    padding: tokens.spacing.sm,
  },
  removeButton: {
    color: tokens.colors.danger,
    ...tokens.typography.small,
    marginTop: tokens.spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  totalLabel: {
    ...tokens.typography.body,
    color: tokens.colors.neutral[700],
  },
  totalValue: {
    ...tokens.typography.body,
    color: tokens.colors.neutral[900],
    fontWeight: '600',
  },
  grandTotal: {
    borderTopWidth: 2,
    borderTopColor: tokens.colors.neutral[300],
    paddingTop: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  grandTotalLabel: {
    ...tokens.typography.h3,
    color: tokens.colors.neutral[900],
  },
  grandTotalValue: {
    ...tokens.typography.h3,
    color: tokens.colors.primary,
  },
  submitButton: {
    marginVertical: tokens.spacing.xl,
  },
});
```

---

This mobile guide continues with more screens and features. Would you like me to continue with:
1. Expense scanning screen
2. Tax calculator screen
3. Dashboard with charts
4. More utility components
5. Testing examples?
