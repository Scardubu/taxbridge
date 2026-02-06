/**
 * GlobalSearch Component
 * 
 * Phase 7: User Flow Optimizations
 * 
 * Universal search bar for the dashboard that searches across:
 * - Invoices (by number, customer, amount)
 * - Customers (by name, business)
 * - Transactions (by reference, amount)
 * 
 * Features:
 * - Debounced search
 * - Recent searches persistence
 * - Quick filters
 * - Keyboard-aware positioning
 * - Accessibility support
 */

import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  Keyboard,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import { trackEvent } from '../services/analytics';
import { SkeletonLoader } from './ui/SkeletonLoader';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

type SearchCategory = 'all' | 'invoices' | 'customers' | 'transactions';

interface SearchResult {
  id: string;
  type: 'invoice' | 'customer' | 'transaction';
  title: string;
  subtitle: string;
  metadata?: string;
  icon: string;
}

interface GlobalSearchProps {
  onSelectResult: (result: SearchResult) => void;
  onSearch?: (query: string, category: SearchCategory) => Promise<SearchResult[]>;
  placeholder?: string;
  autoFocus?: boolean;
  showFilters?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const RECENT_SEARCHES_KEY = 'tb_recent_searches';
const MAX_RECENT_SEARCHES = 5;
const DEBOUNCE_MS = 300;

const CATEGORY_FILTERS: { key: SearchCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'search.filters.all', icon: '🔍' },
  { key: 'invoices', label: 'search.filters.invoices', icon: '📄' },
  { key: 'customers', label: 'search.filters.customers', icon: '👥' },
  { key: 'transactions', label: 'search.filters.transactions', icon: '💳' },
];

// ============================================================================
// Mock search function (replace with real implementation)
// ============================================================================

const mockSearch = async (query: string, category: SearchCategory): Promise<SearchResult[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  
  // Mock data - in production, this would call your backend
  const mockResults: SearchResult[] = [
    {
      id: 'inv-001',
      type: 'invoice',
      title: 'INV-2024-001',
      subtitle: 'Chukwu Enterprises',
      metadata: '₦125,000',
      icon: '📄',
    },
    {
      id: 'inv-002',
      type: 'invoice',
      title: 'INV-2024-002',
      subtitle: 'Adamu Trading Co.',
      metadata: '₦85,500',
      icon: '📄',
    },
    {
      id: 'cust-001',
      type: 'customer',
      title: 'Chukwu Enterprises',
      subtitle: 'Lagos, Nigeria',
      metadata: '15 invoices',
      icon: '👤',
    },
    {
      id: 'cust-002',
      type: 'customer',
      title: 'Adamu Trading Co.',
      subtitle: 'Kano, Nigeria',
      metadata: '8 invoices',
      icon: '👤',
    },
    {
      id: 'txn-001',
      type: 'transaction',
      title: 'Payment Received',
      subtitle: 'REF: REM-2024-5678',
      metadata: '₦125,000',
      icon: '💳',
    },
  ];
  
  let filtered = mockResults.filter(
    r => r.title.toLowerCase().includes(lowerQuery) || r.subtitle.toLowerCase().includes(lowerQuery)
  );
  
  if (category !== 'all') {
    const typeMap: Record<SearchCategory, SearchResult['type'] | null> = {
      all: null,
      invoices: 'invoice',
      customers: 'customer',
      transactions: 'transaction',
    };
    const targetType = typeMap[category];
    if (targetType) {
      filtered = filtered.filter(r => r.type === targetType);
    }
  }
  
  return filtered;
};

// ============================================================================
// Sub-components
// ============================================================================

interface FilterChipProps {
  filter: typeof CATEGORY_FILTERS[0];
  isSelected: boolean;
  onPress: () => void;
}

const FilterChip = memo(({ filter, isSelected, onPress }: FilterChipProps) => {
  const { t } = useTranslation();
  
  return (
    <Pressable
      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(filter.label)}
    >
      <Text style={styles.filterChipIcon}>{filter.icon}</Text>
      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
        {t(filter.label)}
      </Text>
    </Pressable>
  );
});

FilterChip.displayName = 'FilterChip';

interface SearchResultItemProps {
  result: SearchResult;
  onPress: () => void;
}

const SearchResultItem = memo(({ result, onPress }: SearchResultItemProps) => (
  <Pressable
    style={styles.resultItem}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${result.title}, ${result.subtitle}`}
  >
    <View style={styles.resultIcon}>
      <Text style={styles.resultIconText}>{result.icon}</Text>
    </View>
    <View style={styles.resultContent}>
      <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
      <Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
    </View>
    {result.metadata && (
      <Text style={styles.resultMetadata}>{result.metadata}</Text>
    )}
  </Pressable>
));

SearchResultItem.displayName = 'SearchResultItem';

interface RecentSearchItemProps {
  query: string;
  onPress: () => void;
  onRemove: () => void;
}

const RecentSearchItem = memo(({ query, onPress, onRemove }: RecentSearchItemProps) => {
  const { t } = useTranslation();
  
  return (
    <View style={styles.recentItem}>
      <Pressable style={styles.recentItemContent} onPress={onPress}>
        <Text style={styles.recentIcon}>🕐</Text>
        <Text style={styles.recentText} numberOfLines={1}>{query}</Text>
      </Pressable>
      <Pressable
        style={styles.recentRemove}
        onPress={onRemove}
        accessibilityLabel={t('search.removeRecent')}
        hitSlop={8}
      >
        <Text style={styles.recentRemoveText}>✕</Text>
      </Pressable>
    </View>
  );
});

RecentSearchItem.displayName = 'RecentSearchItem';

// ============================================================================
// Main Component
// ============================================================================

function GlobalSearch({
  onSelectResult,
  onSearch = mockSearch,
  placeholder,
  autoFocus = false,
  showFilters = true,
}: GlobalSearchProps) {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerHeight = useSharedValue(56);

  // Load recent searches on mount
  React.useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      if (__DEV__) console.warn('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (searchQuery: string) => {
    try {
      const updated = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      if (__DEV__) console.warn('Failed to save recent search:', error);
    }
  };

  const removeRecentSearch = async (searchQuery: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = recentSearches.filter(q => q !== searchQuery);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const performSearch = useCallback(async (searchQuery: string, searchCategory: SearchCategory) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const searchResults = await onSearch(searchQuery, searchCategory);
      setResults(searchResults);
      trackEvent('search', 'performed', searchQuery, undefined, { category: searchCategory, resultCount: searchResults.length });
    } catch (error) {
      if (__DEV__) console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [onSearch]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    
    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      performSearch(text, category);
    }, DEBOUNCE_MS);
  }, [category, performSearch]);

  const handleCategoryChange = useCallback((newCategory: SearchCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategory(newCategory);
    if (query.trim()) {
      performSearch(query, newCategory);
    }
  }, [query, performSearch]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveRecentSearch(query);
    Keyboard.dismiss();
    onSelectResult(result);
    trackEvent('search', 'result_selected', result.id, undefined, { resultType: result.type });
  }, [query, onSelectResult]);

  const handleRecentPress = useCallback((recentQuery: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(recentQuery);
    performSearch(recentQuery, category);
  }, [category, performSearch]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    containerHeight.value = withSpring(showFilters ? 100 : 56);
  }, [showFilters]);

  const handleBlur = useCallback(() => {
    if (!query.trim() && results.length === 0) {
      setIsFocused(false);
      containerHeight.value = withSpring(56);
    }
  }, [query, results]);

  const clearSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    minHeight: containerHeight.value,
  }));

  const showResults = results.length > 0;
  const showRecent = isFocused && !query.trim() && recentSearches.length > 0;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        {/* Search Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder || t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('search.placeholder')}
          />
          {isLoading && (
            <View style={styles.loader}>
              <SkeletonLoader type="inline" count={1} />
            </View>
          )}
          {query.length > 0 && !isLoading && (
            <Pressable
              style={styles.clearButton}
              onPress={clearSearch}
              accessibilityLabel={t('search.clear')}
              hitSlop={8}
            >
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Category Filters */}
        {showFilters && isFocused && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.filtersContainer}>
            {CATEGORY_FILTERS.map(filter => (
              <FilterChip
                key={filter.key}
                filter={filter}
                isSelected={category === filter.key}
                onPress={() => handleCategoryChange(filter.key)}
              />
            ))}
          </Animated.View>
        )}
      </Animated.View>

      {/* Results Dropdown */}
      {(showResults || showRecent) && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.dropdown}
        >
          {showRecent && !showResults && (
            <>
              <Text style={styles.dropdownHeader}>{t('search.recentSearches')}</Text>
              {recentSearches.map(recentQuery => (
                <RecentSearchItem
                  key={recentQuery}
                  query={recentQuery}
                  onPress={() => handleRecentPress(recentQuery)}
                  onRemove={() => removeRecentSearch(recentQuery)}
                />
              ))}
            </>
          )}
          
          {showResults && (
            <>
              <Text style={styles.dropdownHeader}>
                {t('search.resultsCount', { count: results.length })}
              </Text>
              <FlatList
                data={results}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <SearchResultItem
                    result={item}
                    onPress={() => handleSelectResult(item)}
                  />
                )}
                style={styles.resultsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    height: '100%',
  },
  loader: {
    marginRight: spacing.xs,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.neutralLight,
    gap: 4,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryLight,
  },
  filterChipIcon: {
    fontSize: 12,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 320,
    ...shadows.lg,
  },
  dropdownHeader: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultsList: {
    maxHeight: 280,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconText: {
    fontSize: 18,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  resultSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultMetadata: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  recentItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recentIcon: {
    fontSize: 14,
  },
  recentText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  recentRemove: {
    padding: spacing.xs,
  },
  recentRemoveText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default memo(GlobalSearch);
