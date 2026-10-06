import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';

/** Выбор процессов (US и ФТ) с подстановкой: вводите название или ID, выбираете из подсказок, выбранные остаются метками. */
export function ProcessPicker({ projectKey, value, onChange, label = 'Процесс', hint = 'начните вводить название или ID US или ФТ' }: {
  projectKey: string; value: string[]; onChange: (v: string[]) => void; label?: string; hint?: string;
}) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const all = useAsync(`process-options:${projectKey}`, async () => {
    const [us, fr] = await Promise.all([pthApi.artifactsPage(projectKey, 0, 500, 'US'), pthApi.artifactsPage(projectKey, 0, 500, 'FR')]);
    return [...us.items, ...fr.items];
  });
  const byId = new Map((all.data ?? []).map((a) => [a.display_id, a.title]));
  const q = text.trim().toLowerCase();
  const options = q
    ? (all.data ?? []).filter((a) => !value.includes(a.display_id) && `${a.display_id} ${a.title}`.toLowerCase().includes(q)).slice(0, 8)
    : [];
  const pick = (id: string) => { onChange([...value, id]); setText(''); setActive(0); };
  const listId = `process-list-${label}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-3">
        <label htmlFor={`${listId}-input`} className="text-ui font-medium text-text">{label}</label>
        <span className="text-meta text-text-muted">{hint}</span>
      </div>
      <div className="relative w-full max-w-xl">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-control-border bg-surface px-2 py-1 focus-within:outline-2 focus-within:outline-focus">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-meta text-accent-text" title={byId.get(id)}>
              <span className="font-mono">{id}</span>
              <button type="button" aria-label={`Убрать ${id}`} className="text-text-muted hover:text-text" onClick={() => onChange(value.filter((x) => x !== id))}>×</button>
            </span>
          ))}
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            value={text}
            onChange={(e) => { setText(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && options[active]) { e.preventDefault(); pick(options[active].display_id); }
              else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
            }}
            className="h-7 min-w-40 flex-1 bg-transparent px-1 text-ui text-text outline-none"
          />
        </div>
        {options.length > 0 && (
          <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-control border border-border bg-surface shadow-lg">
            {options.map((o, i) => (
              <li key={o.display_id} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(o.display_id); }}
                className={`flex cursor-pointer gap-2 px-3 py-1.5 text-ui ${i === active ? 'bg-surface-muted' : ''}`}>
                <span className="w-24 shrink-0 font-mono text-meta text-text-muted">{o.display_id}</span>
                <span className="text-text">{o.title}</span>
              </li>
            ))}
          </ul>
        )}
        {q && options.length === 0 && !all.loading && <p className="mt-1 text-meta text-text-muted">Ничего не найдено среди US и ФТ.</p>}
      </div>
    </div>
  );
}
