import React from 'react';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native';
import { spacing } from '../../theme/tokens';

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  [key: string]: any;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  keyExtractor,
  ...props
}: VirtualizedListProps<T>) {
  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
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
