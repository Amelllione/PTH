import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text',
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

/** Текстовый смысл не зависит от цвета (X07, 4.5). */
export function Badge({ label, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-meta font-medium',
        tones[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={16} />}
      {label}
    </span>
  );
}
