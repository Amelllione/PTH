import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface TooltipProps {
  /** Текст подсказки. Доступное имя элемента задаётся отдельно (X07). */
  label: string;
  placement?: 'top' | 'bottom';
  /** start и end — выравнивание по краю элемента: у края экрана подсказка не обрезается. */
  align?: 'center' | 'start' | 'end';
  children: ReactNode;
  className?: string;
}

/**
 * X07 Tooltip: слой поверх интерфейса, разметка не сдвигается.
 * Появляется при наведении и при фокусе с клавиатуры.
 */
export function Tooltip({
  label,
  placement = 'top',
  align = 'center',
  children,
  className,
}: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        // Текст дублирует доступное имя кнопки, поэтому от скринридера скрыт.
        aria-hidden="true"
        className={cn(
          // Ширина по содержимому: длинная подсказка не сжимается в узкую колонку.
          'pointer-events-none absolute z-40 w-max max-w-[min(18rem,calc(100vw-32px))] rounded-control',
          'border border-border bg-surface px-2 py-1 text-meta text-text',
          align === 'start'
            ? 'left-0 text-left'
            : align === 'end'
              ? 'right-0 text-left'
              : 'left-1/2 -translate-x-1/2 text-center',
          'opacity-0 shadow-[0_8px_24px_rgba(41,36,31,0.18)] transition-opacity duration-150',
          // Показывается при наведении и при фокусе с клавиатуры: программный фокус
          // (например, на кнопке закрытия только что открытого диалога) подсказку не открывает.
          'group-hover/tooltip:opacity-100 group-has-[:focus-visible]/tooltip:opacity-100',
          placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
        )}
      >
        {label}
      </span>
    </span>
  );
}
