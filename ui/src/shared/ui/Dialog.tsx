import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Модальный режим удерживает фокус, Escape возвращает его инициатору (4.5). */
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      // Фокус на начале содержимого: кнопка закрытия не «нажата» и её подсказка не всплывает.
      requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
    }
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className={cn(
        'm-auto w-full max-w-[520px] rounded-dialog border border-border bg-surface p-0 text-text',
        'shadow-[0_12px_32px_rgba(41,36,31,0.18)] backdrop:bg-black/40',
        // на телефоне — полноэкранная форма (X02)
        'max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none',
        className,
      )}
    >
      {open && (
        <div
          ref={contentRef}
          tabIndex={-1}
          // Высота ограничена окном: длинное содержимое прокручивается внутри, футер остаётся на виду.
          className="flex h-full max-h-[calc(100dvh-3rem)] flex-col outline-none max-sm:max-h-none"
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-section font-semibold">{title}</h2>
              {description && <p className="mt-1 text-ui text-text-muted">{description}</p>}
            </div>
            <IconButton icon="close" accessibleName="Закрыть" onClick={onClose} />
          </header>
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
            {children}
          </div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4 max-sm:[&>*]:flex-1">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
