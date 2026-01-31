import React from 'react';
import { FlatList, FlatListProps, StyleSheet } from 'react-native';
import { spacing } from '../../theme/tokens';

interface VirtualizedListProps<T> extends Partial<FlatListProps<T>> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  estimatedItemSize?: number;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize = 80,
  ...props
}: VirtualizedListProps<T>) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
      getItemLayout={(_, index) => ({
        length: estimatedItemSize,
        offset: estimatedItemSize * index,
        index,
      })}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.screenPadding,
  },
});
