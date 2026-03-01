/**
 * React Native FlatList / SectionList prop augmentation
 *
 * In @react-native/virtualized-lists@0.81.5 the generated VirtualizedListProps
 * no longer carries all ScrollViewProps (style, contentContainerStyle,
 * refreshControl, snapToInterval, maxToRenderPerBatch, etc.) through its type
 * hierarchy.  The underlying components accept these props at runtime; the
 * missing declarations are a type-generation artefact.  This file restores them
 * via TypeScript declaration merging (purely additive).
 *
 * IMPORTANT: Keep this as a SINGLE declare module block — two blocks for the
 * same module in one file causes TS to silently discard the second block.
 *
 * Remove once upstream ships complete type declarations.
 */

/// <reference types="react" />

import type { StyleProp, ViewStyle, RefreshControlProps } from 'react-native';

declare module 'react-native' {
  /**
   * FlatListProps is defined as an interface in
   *   node_modules/react-native/Libraries/Lists/FlatList.d.ts
   * extending VirtualizedListProps from @react-native/virtualized-lists.
   *
   * All props below are ScrollViewProps / VirtualizedListProps values that
   * the 0.81.5 generated types omit.  Declaration-merging is purely additive
   * so existing callers remain unaffected.
   */
  interface FlatListProps<ItemT> {
    // ── ScrollView-inherited ────────────────────────────────────────
    /** Outer view style (the container, not the content). */
    style?: StyleProp<ViewStyle>;
    /** Style for the internal content-container scroll view. */
    contentContainerStyle?: StyleProp<ViewStyle>;
    /** Pull-to-refresh control. */
    refreshControl?: React.ReactElement<RefreshControlProps>;
    /** Whether keyboard should persist when the list is tapped. */
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
    /** Scrolling enabled flag. */
    scrollEnabled?: boolean;
    /** Width of the snap interval for paging behaviour. */
    snapToInterval?: number;
    /** List of offsets to snap to. */
    snapToOffsets?: number[];
    /** Deceleration rate after lifting the finger. */
    decelerationRate?: 'fast' | 'normal' | number;
    /** Snap alignment. */
    snapToAlignment?: 'start' | 'center' | 'end';
    /** Android over-scroll mode. */
    overScrollMode?: 'always' | 'auto' | 'never';
    /** Invert the list direction. */
    inverted?: boolean;
    /** Whether to bounce at the end. */
    bounces?: boolean;
    /** iOS paging enabled. */
    pagingEnabled?: boolean;
    /** iOS indicator style. */
    indicatorStyle?: 'default' | 'black' | 'white';
    /** iOS scroll-to-top tap. */
    scrollsToTop?: boolean;
    /** Show iOS persistent scroll indicator. */
    persistentScrollbar?: boolean;
    /** Min amount scrolled before onScrollBeginDrag fires. */
    directionalLockEnabled?: boolean;
    /** Show horizontal scroll indicator. */
    showsHorizontalScrollIndicator?: boolean;
    /** Show vertical scroll indicator. */
    showsVerticalScrollIndicator?: boolean;
    /** Offset for scroll indicators. */
    scrollIndicatorInsets?: { top?: number; left?: number; bottom?: number; right?: number };
    /** Maintains visible content position on data change. */
    maintainVisibleContentPosition?: {
      minIndexForVisible: number;
      autoscrollToTopThreshold?: number;
    } | null;
    /** Keyboard dismiss mode. */
    keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
    /** Number of items to render in the initial batch. */
    initialNumToRender?: number;
    /** Index to scroll to after mounting. */
    initialScrollIndex?: number | null;
    /** Extra data to pass to re-render. */
    extraData?: unknown;
    // ── VirtualizedList-inherited (render tuning) ───────────────────
    /** Max items to render per JS event-loop tick. */
    maxToRenderPerBatch?: number;
    /** How long to wait before rendering next batch (ms). */
    updateCellsBatchingPeriod?: number;
    /** Viewport multiplier for virtual window. */
    windowSize?: number;
    /** Allow clipped subviews to be detached from the view hierarchy. */
    removeClippedSubviews?: boolean;
    /** Debug mode — draws helper overlay. */
    debug?: boolean;
    /** Disable virtual-window clipping (performance trade-off). */
    disableVirtualization?: boolean;
    // ── List slots ─────────────────────────────────────────────────
    /** Rendered above all items. */
    ListHeaderComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    /** Rendered below all items. */
    ListFooterComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    ListHeaderComponentStyle?: StyleProp<ViewStyle>;
    ListFooterComponentStyle?: StyleProp<ViewStyle>;
    /** Rendered between each item. */
    ItemSeparatorComponent?: React.ComponentType<unknown> | null;
    /** Rendered when the list is empty. */
    ListEmptyComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    // ── End-reach / infinite scroll ─────────────────────────────────
    /** Fraction of list from the end that triggers onEndReached. */
    onEndReachedThreshold?: number | null;
    /** Called when scroll position is within onEndReachedThreshold of end. */
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
    // ── Custom rendering ────────────────────────────────────────────
    /** Custom cell wrapper component. */
    CellRendererComponent?: React.ComponentType<unknown>;
    /** Number of columns. */
    numColumns?: number;
    /** Style for multi-column rows. */
    columnWrapperStyle?: StyleProp<ViewStyle>;
  }

  /**
   * SectionList shares the same gap — augment its props interface too.
   */
  interface SectionListProps<ItemT, SectionT> {
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    refreshControl?: React.ReactElement<RefreshControlProps>;
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
    scrollEnabled?: boolean;
    inverted?: boolean;
    bounces?: boolean;
    ListHeaderComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    ListFooterComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    ListHeaderComponentStyle?: StyleProp<ViewStyle>;
    ListFooterComponentStyle?: StyleProp<ViewStyle>;
    ListEmptyComponent?: React.ComponentType<unknown> | React.ReactElement | null;
    onEndReachedThreshold?: number | null;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    maxToRenderPerBatch?: number;
    windowSize?: number;
    removeClippedSubviews?: boolean;
  }
}

