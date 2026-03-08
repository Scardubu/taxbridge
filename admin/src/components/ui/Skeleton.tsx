import type { CSSProperties } from 'react';

type SkeletonProps = {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: CSSProperties;
};

export function Skeleton({ height = 16, width = '100%', radius = 12, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface-muted) 0%, rgba(148,163,184,0.18) 50%, var(--surface-muted) 100%)',
        backgroundSize: '200% 100%',
        animation: 'tb-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
