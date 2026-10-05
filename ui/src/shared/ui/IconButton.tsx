import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from './Icon';
import { Tooltip } from './Tooltip';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary';

const variants: Record<IconButtonVariant, string> = {
  ghost: 'text-text-muted hover:bg-surface-muted hover:text-text',
  secondary: 'border border-control-border bg-surface text-text hover:bg-surface-muted',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
};

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** Иконка без текста обязана иметь доступное имя (X07). */
  accessibleName: string;
  variant?: IconButtonVariant;
  size?: 16 | 20;
  /** Толщина линии значка; по умолчанию обычная (1.5). */
  iconStrokeWidth?: number;
  /** Подсказка выводится слоем поверх интерфейса; выключается для особых случаев. */
  tooltip?: boolean;
  tooltipPlacement?: 'top' | 'bottom';
  /** Текст подсказки, если он должен отличаться от доступного имени. */
  tooltipLabel?: string;
  wrapperClassName?: string;
}

export function IconButton({
  icon,
  accessibleName,
  variant = 'ghost',
  size = 20,
  iconStrokeWidth,
  type = 'button',
  tooltip = true,
  tooltipPlacement = 'bottom',
  tooltipLabel,
  wrapperClassName,
  className,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={accessibleName}
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-control',
        'transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-60',
        // сенсорная область 44 × 44 px поверх визуальных 36 px (4.3)
        'after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]',
        variants[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} strokeWidth={iconStrokeWidth} />
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip
      label={tooltipLabel ?? accessibleName}
      placement={tooltipPlacement}
      className={cn('shrink-0', wrapperClassName)}
    >
      {button}
    </Tooltip>
  );
}
