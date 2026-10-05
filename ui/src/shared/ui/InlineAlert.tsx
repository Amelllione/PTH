import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon } from './Icon';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

const tones: Record<AlertTone, string> = {
  danger: 'border-danger-text/40 bg-danger-soft text-danger-text',
  warning: 'border-warning-text/40 bg-warning-soft text-warning-text',
  info: 'border-info-text/40 bg-info-soft text-info-text',
  success: 'border-success-text/40 bg-success-soft text-success-text',
};

export interface InlineAlertProps {
  message: string;
  tone?: AlertTone;
  action?: ReactNode;
  className?: string;
}

/** Критическая ошибка остаётся рядом с операцией (X07). */
export function InlineAlert({ message, tone = 'danger', action, className }: InlineAlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-card border px-3 py-2 text-ui',
        tones[tone],
        className,
      )}
    >
      <Icon name={tone === 'success' ? 'check' : 'alert'} size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {action}
    </div>
  );
}
