import React from 'react';

const shallowEqual = (objA: Record<string, unknown>, objB: Record<string, unknown>): boolean => {
  if (Object.is(objA, objB)) return true;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !Object.is(objA[key], objB[key])) {
      return false;
    }
  }
  return true;
};

export const useMemoizedCalculation = <T>(calculator: () => T, deps: React.DependencyList) => {
  return React.useMemo(() => calculator(), deps);
};

export const memoComponent = <P extends object>(
  Component: React.FC<P>
): React.NamedExoticComponent<P> => {
  return React.memo(Component, (prevProps, nextProps) => shallowEqual(prevProps, nextProps));
};
