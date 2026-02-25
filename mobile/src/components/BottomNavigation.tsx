/**
 * TaxBridge BottomNavigation — V3.0 Production Build
 *
 * BUG-S01 fix: uses @expo/vector-icons (Ionicons) — no □ squares
 * CF-04: useTheme() for dark mode
 * CF-15: active tab = color + underline dot + text label (never color alone)
 * Accessibility: role="tab", accessibilityState.selected
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@hooks/useTheme';
import { typography, spacing, shadows, radii } from '@ds/tokens';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface TabConfig {
  key:      string;
  route:    string;
  labelKey: string;
  icon:     IoniconName;
  iconFocused: IoniconName;
}

export const TAB_CONFIG: TabConfig[] = [
  {
    key:         'dashboard',
    route:       '/(tabs)',
    labelKey:    'nav.dashboard',
    icon:        'home-outline',
    iconFocused: 'home',
  },
  {
    key:         'invoices',
    route:       '/(tabs)/invoices',
    labelKey:    'nav.invoices',
    icon:        'document-text-outline',
    iconFocused: 'document-text',
  },
  {
    key:         'insights',
    route:       '/(tabs)/insights',
    labelKey:    'nav.insights',
    icon:        'bar-chart-outline',
    iconFocused: 'bar-chart',
  },
  {
    key:         'tools',
    route:       '/(tabs)/tools',
    labelKey:    'nav.tools',
    icon:        'calculator-outline',
    iconFocused: 'calculator',
  },
  {
    key:         'profile',
    route:       '/(tabs)/profile',
    labelKey:    'nav.profile',
    icon:        'person-outline',
    iconFocused: 'person',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BottomNavigationProps {
  /** The key of the currently active tab */
  activeTab: string;
  /** Called when the user taps a tab */
  onTabPress: (tab: TabConfig) => void;
  /** Optional badge counts — key = tab key, value = count */
  badges?: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNavigation({
  activeTab,
  onTabPress,
  badges = {},
}: BottomNavigationProps) {
  const insets         = useSafeAreaInsets();
  const { t }          = useTranslation();
  const { colors, isDark } = useTheme();  // CF-04 dark-mode safe

  const bg             = isDark ? colors.surface : colors.background;
  const activeTint     = colors.primary[500];
  const inactiveTint   = colors.textMuted;
  const borderColor    = colors.gray?.[200] ?? '#E5E7EB';

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: bg,
          borderTopColor:  borderColor,
          paddingBottom:   Math.max(insets.bottom, 8),
        },
        ...shadows.md ? [shadows.md] : [],
      ]}
      accessibilityRole="tablist"
    >
      {TAB_CONFIG.map((tab) => {
        const isActive    = activeTab === tab.key;
        const badgeCount  = badges[tab.key] ?? 0;
        const iconName    = isActive ? tab.iconFocused : tab.icon;
        const tint        = isActive ? activeTint : inactiveTint;

        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              s.tab,
              pressed && s.tabPressed,
            ]}
            onPress={() => onTabPress(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {/* CF-15: active indicator = underline dot + color + label text */}
            <View style={[s.activeDot, isActive && { backgroundColor: activeTint }]} />

            {/* Icon */}
            <View style={s.iconWrapper}>
              <Ionicons
                name={iconName}
                size={24}
                color={tint}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              {/* Badge */}
              {badgeCount > 0 && (
                <View style={[s.badge, { backgroundColor: colors.error }]}>
                  <Text style={s.badgeText}>
                    {badgeCount > 99 ? '99+' : String(badgeCount)}
                  </Text>
                </View>
              )}
            </View>

            {/* Label — always visible (CF-15: text alongside color/icon) */}
            <Text
              style={[
                s.label,
                isActive
                  ? { color: activeTint, fontWeight: typography.weights.semibold }
                  : { color: inactiveTint, fontWeight: typography.weights.regular },
              ]}
              numberOfLines={1}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flexDirection:  'row',
    borderTopWidth: 1,
    paddingTop:     4,
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: spacing[2],
    gap:            3,
  },
  tabPressed: {
    opacity: 0.65,
  },
  // CF-15: active indicator — shape (underline pill) + color + label text
  activeDot: {
    height:       3,
    width:        24,
    borderRadius: radii.full,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position:     'absolute',
    top:          -4,
    right:        -7,
    minWidth:     16,
    height:       16,
    borderRadius: 8,
    alignItems:   'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color:      '#FFFFFF',
    fontSize:   9,
    fontWeight: '700',
    lineHeight: 14,
  },
  label: {
    fontSize: 10,
  },
});

export default BottomNavigation;
