import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '@/shared/lib/cn';
import { Popover } from './Popover';

export interface MenuItem {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Видимая причина недоступности (4.4). */
  disabledReason?: string;
  onSelect: () => void;
}

export interface MenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  items: MenuItem[];
  label: string;
  placement?: 'bottom-start' | 'bottom-end';
}

export function Menu({ open, onOpenChange, triggerRef, items, label, placement }: MenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const first = listRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  const focusItem = (index: number) => {
    const nodes = listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!nodes || nodes.length === 0) return;
    const next = (index + nodes.length) % nodes.length;
    setActiveIndex(next);
    nodes[next]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      triggerRef={triggerRef}
      placement={placement}
      label={label}
    >
      <div
        ref={listRef}
        role="menu"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusItem(activeIndex + 1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusItem(activeIndex - 1);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            focusItem(0);
          }
          if (event.key === 'End') {
            event.preventDefault();
            focusItem(items.length - 1);
          }
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={item.disabled}
            title={item.disabled ? item.disabledReason : undefined}
            onClick={() => {
              onOpenChange(false);
              triggerRef.current?.focus();
              item.onSelect();
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-ui',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
              'disabled:cursor-not-allowed disabled:opacity-60',
              item.tone === 'danger'
                ? 'text-danger-text hover:bg-danger-soft'
                : 'text-text hover:bg-surface-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}

export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-meta font-medium uppercase tracking-wide text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
