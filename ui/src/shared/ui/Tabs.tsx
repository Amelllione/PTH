import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  selectedId: string;
  onChange: (id: string) => void;
  /** Доступное имя списка вкладок. */
  label: string;
  /** Префикс идентификаторов: вкладка `${idPrefix}-tab-${id}`, панель `${idPrefix}-panel-${id}`. */
  idPrefix: string;
  className?: string;
}

/** X07 Tabs: видимые названия, стрелки и Home/End переключают вкладки. */
export function Tabs({ items, selectedId, onChange, label, idPrefix, className }: TabsProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const select = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    onChange(item.id);
    refs.current.get(item.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap gap-1 border-b border-border', className)}
    >
      {items.map((item, index) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) refs.current.set(item.id, node);
              else refs.current.delete(item.id);
            }}
            id={`${idPrefix}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative -mb-px h-9 shrink-0 whitespace-nowrap border-b-2 px-3 text-ui transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
              selected
                ? 'border-primary font-medium text-text'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
