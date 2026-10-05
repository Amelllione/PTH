import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';

/** Загрузка не изображает реальные данные (X07). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control bg-surface-muted', className)}
    />
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Загрузка списка">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export interface StateBlockProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}

/** Пустота, ошибка и отсутствие доступа различаются (X07). */
export function EmptyState({
  title,
  description,
  icon = 'chat',
  action,
  className,
}: StateBlockProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
      <Icon name={icon} className="text-text-muted" />
      <p className="text-ui font-medium text-text">{title}</p>
      {description && <p className="max-w-80 text-ui text-text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
  className,
}: Omit<StateBlockProps, 'icon'>) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}
    >
      <Icon name="alert" className="text-danger-text" />
      <p className="text-ui font-medium text-text">{title}</p>
      {description && <p className="max-w-80 text-ui text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
