import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Элемент, к которому привязано всплывающее окно; ему возвращается фокус. */
  triggerRef: RefObject<HTMLElement | null>;
  placement?: 'bottom-start' | 'bottom-end';
  children: ReactNode;
  className?: string;
  label?: string;
}

interface Position {
  top: number;
  left: number;
  maxHeight: number;
}

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * X07 Popover: слой в портале поверх интерфейса.
 * Не обрезается прокручиваемыми панелями, не перекрывается соседними карточками
 * и не выходит за экран: при нехватке места снизу открывается вверх.
 */
export function Popover({
  open,
  onOpenChange,
  triggerRef,
  placement = 'bottom-start',
  children,
  className,
  label,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      const panel = ref.current;
      if (!trigger || !panel) return;

      const rect = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.scrollHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const preferredLeft = placement === 'bottom-end' ? rect.right - width : rect.left;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, preferredLeft),
        Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
      );

      const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
      const openUp = height > spaceBelow && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
      const top = openUp
        ? Math.max(VIEWPORT_MARGIN, rect.top - GAP - Math.min(height, maxHeight))
        : rect.bottom + GAP;

      setPosition({ top, left, maxHeight });
    };

    update();
    window.addEventListener('resize', update);
    // Прокрутка любой области (лента, панель) сдвигает инициатора.
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, placement, triggerRef]);

  // 4.7: открытое окно сразу принимает фокус на первом доступном элементе.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const panel = ref.current;
      if (!panel || panel.contains(document.activeElement)) return;
      panel
        .querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpenChange(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  // Внутри модального окна слой рисуется в нём: иначе top layer диалога перекроет меню.
  const container =
    (triggerRef.current?.closest('dialog[open]') as HTMLElement | null) ?? document.body;

  // Портал наследует токены темы: data-theme установлен на html (5.2).
  return createPortal(
    <div
      ref={ref}
      aria-label={label}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-50 min-w-56 overflow-y-auto rounded-card border border-border bg-surface p-1 text-text',
        'shadow-[0_8px_24px_rgba(41,36,31,0.16)]',
        className,
      )}
    >
      {children}
    </div>,
    container,
  );
}
