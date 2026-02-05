/**
 * TaxBridge Admin Dashboard - Chart Color Tokens
 * 
 * Semantic color system aligned with mobile design tokens
 * Ensures consistency across mobile app and admin dashboard
 */

export const chartColors = {
  // Status Colors (matching mobile semantic tokens)
  success: '#10b981',      // green-600 (successful transactions, compliant status)
  warning: '#f59e0b',      // amber-500 (pending transactions, warnings)
  error: '#ef4444',        // red-500 (failed transactions, non-compliant)
  info: '#3b82f6',         // blue-500 (informational metrics, counts)
  
  // Chart-specific colors
  primary: '#8884d8',      // Default Recharts primary
  secondary: '#82ca9d',    // Default Recharts secondary
  
  // Extended palette for multi-series charts
  palette: [
    '#10b981', // green-600
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
  ],
} as const;

/**
 * Usage Example:
 * 
 * import { chartColors } from '@/lib/colors';
 * 
 * <Bar dataKey="successful" fill={chartColors.success} />
 * <Line stroke={chartColors.info} />
 */
