import { useRef } from 'react';
import { cn } from '@/shared/lib/cn';

export interface ResizeHandleProps {
  /** Текущая ширина области в px. */
  value: number;
  min: number;
  max: number;
  label: string;
  step?: number;
  /** Сторона, с которой находится изменяемая область. */
  side?: 'left' | 'right';
  onChange: (value: number) => void;
  className?: string;
}

/** Разделитель: 1 px визуально, 8 px интерактивно, стрелки с клавиатуры (2.2, 4.5). */
export function ResizeHandle({
  value,
  min,
  max,
  label,
  step = 16,
  side = 'left',
  onChange,
  className,
}: ResizeHandleProps) {
  const dragging = useRef(false);

  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(event) => {
        const direction = side === 'left' ? 1 : -1;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onChange(clamp(value - step * direction));
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onChange(clamp(value + step * direction));
        }
        if (event.key === 'Home') {
          event.preventDefault();
          onChange(min);
        }
        if (event.key === 'End') {
          event.preventDefault();
          onChange(max);
        }
      }}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!bounds) return;
        const next = side === 'left' ? event.clientX - bounds.left : bounds.right - event.clientX;
        onChange(clamp(next));
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      className={cn(
        'group relative w-2 shrink-0 cursor-col-resize touch-none',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-control-border"
      />
    </div>
  );
}
