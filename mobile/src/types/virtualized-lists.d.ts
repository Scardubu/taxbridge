/**
 * Ambient type stub for @react-native/virtualized-lists
 *
 * The package ships without a root index.d.ts in v0.81.5, which breaks
 * FlatList / VirtualizedList type resolution (contentContainerStyle,
 * refreshControl, ListRenderItem, etc. are all missing).
 *
 * This stub provides the minimal public surface that react-native's
 * Libraries/Lists/FlatList.d.ts and VirtualizedList.d.ts re-export.
 *
 * C-07 / maintenance note: remove this file once @react-native/virtualized-lists
 * ships a complete index.d.ts.
 */

import type React from 'react';
import type { StyleProp, ViewStyle, ScrollViewProps } from 'react-native';

declare module '@react-native/virtualized-lists' {
  export interface Separators {
    highlight(): void;
    unhighlight(): void;
    updateProps(select: 'leading' | 'trailing', newProps: Record<string, unknown>): void;
  }

  export interface ListRenderItemInfo<ItemT> {
    item: ItemT;
    index: number;
    separators: Separators;
  }

  export type ListRenderItem<ItemT> = (
    info: ListRenderItemInfo<ItemT>,
  ) => React.ReactElement | null;

  /**
   * ViewToken — used by onViewableItemsChanged, viewabilityConfig, etc.
   */
  export interface ViewToken<ItemT = unknown> {
    item: ItemT;
    key: string;
    index: number | null;
    isViewable: boolean;
    section?: unknown;
  }

  /**
   * ViewabilityConfig — passed to viewabilityConfig prop.
   */
  export interface ViewabilityConfig {
    minimumViewTime?: number;
    viewAreaCoveragePercentThreshold?: number;
    itemVisiblePercentThreshold?: number;
    waitForInteraction?: boolean;
  }

  /**
   * VirtualizedListProps — the shared base for FlatList / SectionList.
   * Extends React Native's ScrollViewProps so that scroll-related props
   * (contentContainerStyle, refreshControl, onScrollBeginDrag, etc.) are
   * available on every virtualised list component.
   */
  export interface VirtualizedListProps<ItemT> extends ScrollViewProps {
    // Required
    data: unknown;
    getItem(data: unknown, index: number): ItemT;
    getItemCount(data: unknown): number;
    renderItem: ListRenderItem<ItemT>;

    // Key extraction
    keyExtractor?(item: ItemT, index: number): string;

    // Item layout optimisation
    getItemLayout?(
      data: unknown,
      index: number,
    ): { length: number; offset: number; index: number };

    // List component slots
    ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
    ListFooterComponent?: React.ComponentType | React.ReactElement | null;
    ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
    ListFooterComponentStyle?: StyleProp<ViewStyle>;
    ListHeaderComponentStyle?: StyleProp<ViewStyle>;

    // Render optimisation
    initialNumToRender?: number;
    initialScrollIndex?: number;
    maxToRenderPerBatch?: number;
    updateCellsBatchingPeriod?: number;
    windowSize?: number;
    removeClippedSubviews?: boolean;

    // Scroll events
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
    onEndReachedThreshold?: number | null;
    onRefresh?: (() => void) | null;
    onScrollToIndexFailed?: (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => void;
    onViewableItemsChanged?: ((info: {
      viewableItems: ViewToken<ItemT>[];
      changed: ViewToken<ItemT>[];
    }) => void) | null;

    // Viewability
    viewabilityConfig?: ViewabilityConfig;

    // Miscellaneous
    debug?: boolean;
    disableVirtualization?: boolean;
    extraData?: unknown;
    inverted?: boolean;
    persistentScrollbar?: boolean;
    progressViewOffset?: number;
    CellRendererComponent?: React.ComponentType;
    ItemSeparatorComponent?: React.ComponentType | null;
  }

  /**
   * VirtualizedList component — typed as a class component so it can be
   * referenced via `typeof VirtualizedLists.VirtualizedList`.
   */
  declare class VirtualizedList<ItemT = unknown> extends React.PureComponent<
    VirtualizedListProps<ItemT>
  > {
    scrollToEnd(params?: { animated?: boolean }): void;
    scrollToIndex(params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }): void;
    scrollToItem(params: { item: ItemT; animated?: boolean; viewPosition?: number }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
    recordInteraction(): void;
    flashScrollIndicators(): void;
    getScrollableNode(): unknown;
    getScrollRef(): unknown;
  }

  const VirtualizedLists: {
    VirtualizedList: typeof VirtualizedList;
  };

  export default VirtualizedLists;
}
