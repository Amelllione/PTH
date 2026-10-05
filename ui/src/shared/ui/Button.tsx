import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-colors duration-150 select-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/** Статическая таблица классов: динамические строки Tailwind не находит (5.2). */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-control-border bg-surface text-text hover:bg-surface-muted',
  ghost: 'text-text hover:bg-surface-muted',
  danger: 'bg-danger-soft text-danger-text hover:brightness-95',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-ui',
  md: 'h-9 px-4 text-ui',
};

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Расширяет сенсорную область до 44 px без изменения визуальной высоты (4.3). */
  touchTarget?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  touchTarget = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        touchTarget &&
          'after:absolute after:left-0 after:top-1/2 after:h-11 after:w-full after:-translate-y-1/2 after:content-[""]',
        className,
      )}
      {...rest}
    >
      {/* loading сохраняет ширину: текст остаётся в потоке (X07) */}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading && <Spinner />}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="absolute size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
