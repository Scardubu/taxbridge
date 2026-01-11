import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
  variant?: 'default' | 'primary' | 'light';
}

export function LoadingSpinner({ 
  size = 'md', 
  className,
  label,
  variant = 'default'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-[3px]',
    xl: 'h-12 w-12 border-4',
  };

  const variantClasses = {
    default: 'border-slate-200 border-t-slate-900',
    primary: 'border-blue-200 border-t-blue-600',
    light: 'border-white/30 border-t-white',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div 
        className={cn(
          'animate-spin rounded-full',
          sizeClasses[size],
          variantClasses[variant]
        )}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && (
        <span className="text-sm text-slate-600 animate-pulse">{label}</span>
      )}
    </div>
  );
}

// Full page loading state
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <LoadingSpinner size="xl" variant="primary" />
      <p className="text-slate-600 font-medium">{message}</p>
    </div>
  );
}

// Inline loading state for buttons
export function ButtonLoader() {
  return <LoadingSpinner size="sm" variant="light" className="inline-flex" />;
}
