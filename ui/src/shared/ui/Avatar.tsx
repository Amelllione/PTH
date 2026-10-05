import { cn } from '@/shared/lib/cn';

export interface AvatarProps {
  /** Полное имя остаётся рядом текстом; аватар — резервное представление без изображения (X07). */
  name: string;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-7 text-meta',
  md: 'size-9 text-ui',
  lg: 'size-12 text-section',
};

export function Avatar({ name, initials, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent-text',
        sizes[size],
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}
