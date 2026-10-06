import { useState } from 'react';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Боковое меню разделов, сгруппированных по смыслу. На узком экране прячется за кнопкой «Меню». */
export function SideNav({ groups, selectedId, onSelect, label = 'Разделы' }: { groups: NavGroup[]; selectedId: string; onSelect: (id: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-control border border-control-border bg-surface px-3 py-2 text-ui text-text lg:hidden">
        <span>Меню: {groups.flatMap((g) => g.items).find((i) => i.id === selectedId)?.label}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <nav aria-label={label} className={`${open ? 'flex' : 'hidden'} flex-col gap-4 lg:flex`}>
        {groups.map((g) => (
          <div key={g.title} role="group" aria-labelledby={`nav-${g.title}`} className="flex flex-col gap-0.5">
            <h2 id={`nav-${g.title}`} className="px-3 pb-1 text-meta font-medium text-text-muted">{g.title}</h2>
            {g.items.map((item) => {
              const current = item.id === selectedId;
              return (
                <button key={item.id} type="button" aria-current={current ? 'page' : undefined}
                  onClick={() => { onSelect(item.id); setOpen(false); }}
                  className={`rounded-control px-3 py-1.5 text-left text-ui transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
                    current ? 'bg-accent-soft font-medium text-accent-text' : 'text-text hover:bg-surface-muted'}`}>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
