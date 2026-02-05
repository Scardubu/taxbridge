import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors, spacing, radii } from '../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SKELETON_ANIMATION_DURATION = 1200;

interface SkeletonLoaderProps {
  type: 'invoice-card' | 'dashboard' | 'list-item';
  count?: number;
  animated?: boolean;
}

/**
 * SkeletonLoader Component
 * 
 * Contextual skeleton loading states:
 * - Replaces generic ActivityIndicator
 * - Shows content structure while loading
 * - Smooth pulse animation
 */
export const SkeletonLoader = memo<SkeletonLoaderProps>(({
  type,
  count = 3,
  animated = true,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (!animated) return {};
    
    return {
      opacity: withTiming(0.5, {
        duration: SKELETON_ANIMATION_DURATION,
      }),
    };
  });

  const renderSkeleton = () => {
    switch (type) {
      case 'invoice-card':
        return <InvoiceCardSkeleton style={animated ? animatedStyle : {}} />;
      case 'dashboard':
        return <DashboardSkeleton style={animated ? animatedStyle : {}} />;
      case 'list-item':
        return <ListItemSkeleton style={animated ? animatedStyle : {}} />;
      default:
        return null;
    }
  };

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn}
      exiting={FadeOut}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.skeletonWrapper}>
          {renderSkeleton()}
        </View>
      ))}
    </Animated.View>
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

// Invoice Card Skeleton
const InvoiceCardSkeleton = ({ style }: { style?: any }) => (
  <Animated.View style={[styles.invoiceCard, style]}>
    <View style={styles.invoiceHeader}>
      <View style={[styles.skeletonBox, styles.invoiceCustomerName]} />
      <View style={[styles.skeletonBox, styles.invoiceStatusBadge]} />
    </View>
    
    <View style={styles.invoiceDetails}>
      <View style={[styles.skeletonBox, styles.invoiceDate]} />
      <View style={[styles.skeletonBox, styles.invoiceAmount]} />
    </View>
  </Animated.View>
);

// Dashboard Skeleton
const DashboardSkeleton = ({ style }: { style?: any }) => (
  <Animated.View style={[styles.dashboard, style]}>
    <View style={[styles.skeletonBox, styles.dashboardHeader]} />
    <View style={styles.dashboardStats}>
      <View style={[styles.skeletonBox, styles.dashboardStatCard]} />
      <View style={[styles.skeletonBox, styles.dashboardStatCard]} />
    </View>
    <View style={[styles.skeletonBox, styles.dashboardChart]} />
  </Animated.View>
);

// List Item Skeleton
const ListItemSkeleton = ({ style }: { style?: any }) => (
  <Animated.View style={[styles.listItem, style]}>
    <View style={[styles.skeletonBox, styles.listItemIcon]} />
    <View style={styles.listItemContent}>
      <View style={[styles.skeletonBox, styles.listItemTitle]} />
      <View style={[styles.skeletonBox, styles.listItemSubtitle]} />
    </View>
  </Animated.View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonWrapper: {
    marginBottom: spacing.md,
  },
  skeletonBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
  },
  
  // Invoice Card
  invoiceCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  invoiceCustomerName: {
    width: '60%',
    height: 20,
  },
  invoiceStatusBadge: {
    width: 60,
    height: 24,
    borderRadius: radii.sm,
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    width: '40%',
    height: 16,
  },
  invoiceAmount: {
    width: '35%',
    height: 24,
  },
  
  // Dashboard
  dashboard: {
    flex: 1,
    padding: spacing.lg,
  },
  dashboardHeader: {
    width: '70%',
    height: 32,
    marginBottom: spacing.xl,
  },
  dashboardStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dashboardStatCard: {
    flex: 1,
    height: 100,
    borderRadius: radii.lg,
  },
  dashboardChart: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
  },
  
  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    width: '70%',
    height: 18,
    marginBottom: spacing.xs,
  },
  listItemSubtitle: {
    width: '50%',
    height: 14,
  },
});
