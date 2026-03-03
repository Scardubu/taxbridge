/**
 * SectionState — V12 APEX
 * Generic async-data state machine for dashboard zones and list sections.
 * Gate: empty={null} renders nothing (no wrapper element emitted).
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

interface SectionStateProps<T> {
  data: T | null | undefined;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  loading: ReactNode;
  empty: ReactNode | null;
  errorView: ReactNode;
  children: (data: T) => ReactNode;
}

export function SectionState<T>({
  data,
  isLoading,
  error,
  isEmpty,
  loading,
  empty,
  errorView,
  children,
}: SectionStateProps<T>): React.ReactElement | null {
  // 1. Loading — show skeleton only when no cached data
  if (isLoading && !data) {
    return <>{loading}</>;
  }

  // 2. Error — show error view with retry affordance
  if (error) {
    return <>{errorView}</>;
  }

  // 3. Empty — null means "render nothing" (no wrapper)
  if (isEmpty || data == null) {
    if (empty === null) return null;
    return <>{empty}</>;
  }

  // 4. Data — render children with guaranteed non-null data
  return <>{children(data as T)}</>;
}

export default SectionState;
