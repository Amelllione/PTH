import { useEffect, useMemo, useRef, useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, Pager, TextField } from '@/shared/ui';
import { SourcePane } from './SourcePane';
import { LINK_RULES, TYPE_LABEL, marksOf, type DraftItem, type DraftLink, type ItemType } from './draft';
import { locateQuote } from './quote';

const PAGE = 8;
type Filter = 'all' | 'created' | 'revised' | 'unchanged' | 'problems';
const FILTERS: [Filter, string][] = [['all', 'Все'], ['created', 'Новые'], ['revised', 'Новые ревизии'], ['unchanged', 'Без изменений'], ['problems', 'С проблемами']];

const fieldClass = 'rounded-control border border-control-border bg-surface px-2 text-ui text-text';

/** Предпросмотр того, что будет создано: элементы и связи правятся здесь, рядом исходный текст с подсвеченными фрагментами. */
export function DraftReview({ projectKey, sourceName, text, initialItems, initialLinks, unparsed = [], origin, onDone, onBack }: {
  projectKey: string;
  sourceName: string;
  text: string;
  initialItems: DraftItem[];
  initialLinks: DraftLink[];
  unparsed?: string[];
  origin: 'table' | 'llm';
  onDone: (message: string) => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [links, setLinks] = useState(initialLinks);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [title, setTitle] = useState(origin === 'table' ? `Импорт: ${sourceName}` : `Выделено моделью: ${sourceName}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const patch = (ref: string, change: Partial<DraftItem>) => setItems((all) => all.map((i) => (i.ref === ref ? { ...i, ...change } : i)));
  const included = items.filter((i) => i.include);
  const problem = (i: DraftItem) => i.via === 'llm' && (!i.quote || !i.verified);
  const shown = items.filter((i) => (filter === 'all' ? true : filter === 'problems' ? problem(i) : i.action === filter));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const pageItems = shown.slice(current * PAGE, (current + 1) * PAGE);
  const marks = useMemo(() => marksOf(items, text), [items, text]);

  // Выбор в тексте: показываем страницу с этим элементом и прокручиваем карточку.
  const selectFromText = (ref: string) => {
    setSelected(ref);
    const index = shown.findIndex((i) => i.ref === ref);
    if (index >= 0) setPage(Math.floor(index / PAGE));
    window.setTimeout(() => document.getElementById(`draft-item-${ref}`)?.scrollIntoView({ block: 'nearest' }), 50);
  };

  const counts = {
    created: included.filter((i) => i.action === 'created').length,
    revised: included.filter((i) => i.action === 'revised').length,
    links: links.filter((l) => linkAlive(l)).length,
  };
  function linkAlive(l: DraftLink) {
    const live = (r: string) => items.find((i) => i.ref === r)?.include ?? true; // существующие элементы всегда доступны
    return live(l.source) && live(l.target);
  }

  const all = useAsync(`draft-targets:${projectKey}`, async () => {
    const [us, fr, nfr, adr] = await Promise.all(['US', 'FR', 'NFR', 'ADR'].map((t) => pthApi.artifactsPage(projectKey, 0, 500, t)));
    return [...us.items, ...fr.items, ...nfr.items, ...adr.items].map((a) => ({ id: a.display_id, type: a.type as string, title: a.title }));
  });
  const draftIds = new Set(items.map((i) => i.display_id).filter(Boolean));
  const existing = (all.data ?? []).filter((a) => !draftIds.has(a.id));

  const create = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        source: { name: sourceName, text },
        items: included.map((i) => ({
          ref: i.ref, type: i.type, title: i.title.trim(), text: i.text, priority: i.priority || null,
          ...(i.via === 'table'
            ? { display_id: i.display_id, external_key: i.external_key, number: i.number, line: i.line, cols: i.cols }
            : { quote: i.quote, quote_verified: Boolean(i.verified), model: i.model }),
        })),
        relations: links.filter(linkAlive).map((l) => ({ type: l.type, source: l.source, target: l.target })),
      };
      const out = await pthApi.createDraft(projectKey, body);
      if (apply) await pthApi.applyChangeset(projectKey, out.changeset.uid);
      onDone(apply ? `Применено: создано ${counts.created}, новых ревизий ${counts.revised}, связей ${counts.links}.` : `Черновик «${title.trim()}» создан: ${included.length} элементов, ${counts.links} связей. Откройте вкладку «Черновики», чтобы применить.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать черновик');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { setPage(0); }, [filter]);
  const selectedItem = items.find((i) => i.ref === selected) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3 text-ui">
        <Button variant="secondary" size="sm" onClick={onBack}>Назад к источнику</Button>
        <span>Будет создано: <strong>{counts.created}</strong> · новых ревизий: <strong>{counts.revised}</strong> · связей: <strong>{counts.links}</strong></span>
        <span className="text-text-muted">из {items.length} найденных</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setItems((all2) => all2.map((i) => ({ ...i, include: i.action !== 'unchanged' && !(i.via === 'llm' && problem(i)) })))}>Выбрать подходящие</Button>
          <Button size="sm" variant="secondary" onClick={() => setItems((all2) => all2.map((i) => ({ ...i, include: false })))}>Снять все</Button>
        </div>
      </div>
      {unparsed.length > 0 && (
        <InlineAlert tone="warning" message={`Не разобрано строк таблиц с ID: ${unparsed.length}. Первая: ${unparsed[0]}`} />
      )}
      {origin === 'llm' && items.some(problem) && (
        <InlineAlert tone="warning" message="У части предложений цитаты нет или её не удалось найти в тексте дословно. Такие элементы не включены: проверьте формулировку или привяжите цитату, выделив фразу справа." />
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3" ref={listRef}>
          <div role="group" aria-label="Фильтр элементов" className="flex flex-wrap gap-2">
            {FILTERS.map(([f, label]) => (
              <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {label} {f === 'all' ? items.length : f === 'problems' ? items.filter(problem).length : items.filter((i) => i.action === f).length}
              </Button>
            ))}
          </div>
          {pageItems.length === 0 && <p className="text-ui text-text-muted">В этом разделе элементов нет.</p>}
          <ul className="flex flex-col gap-3" aria-label="Элементы черновика">
            {pageItems.map((i) => (
              <ItemCard key={i.ref} item={i} selected={selected === i.ref} items={items} links={links} existing={existing}
                onSelect={() => setSelected(i.ref)} onPatch={(c) => patch(i.ref, c)}
                onLinks={(next) => setLinks(next)} />
            ))}
          </ul>
          <Pager page={current} pageSize={PAGE} total={shown.length} onPage={setPage} label="Страницы элементов" />
        </div>
        <div className="xl:sticky xl:top-4">
          <SourcePane text={text} marks={marks} active={selected} activeLabel={selectedItem?.title.slice(0, 40)} onSelect={selectFromText}
            onQuote={origin === 'llm' ? (quote) => {
              if (!selected) return;
              const spot = locateQuote(text, quote);
              patch(selected, { quote, verified: Boolean(spot), include: Boolean(spot) ? true : items.find((i) => i.ref === selected)?.include ?? false });
              if (!spot) setError('Выделенное не удалось найти в исходном тексте дословно: выделяйте на вкладке «Исходник».');
            } : undefined} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {error && <InlineAlert tone="danger" message={error} />}
        <div className="flex flex-wrap items-end gap-3">
          <TextField label="Название черновика" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className="w-96" />
          <Button variant="secondary" disabled={busy || included.length === 0 || !title.trim()} onClick={() => void create(false)}>Создать черновик</Button>
          <Button variant="primary" loading={busy} disabled={busy || included.length === 0 || !title.trim()} onClick={() => void create(true)}>Создать и применить</Button>
        </div>
        <p className="text-meta text-text-muted">Черновик — это набор изменений, который можно проверить на вкладке «Черновики» и применить позже. «Создать и применить» делает оба шага сразу. Источник сохраняется вместе с привязкой фрагментов к элементам.</p>
      </div>
    </div>
  );
}

type Target = { id: string; type: string; title: string };

function ItemCard({ item, selected, items, links, existing, onSelect, onPatch, onLinks }: {
  item: DraftItem; selected: boolean; items: DraftItem[]; links: DraftLink[]; existing: Target[];
  onSelect: () => void; onPatch: (c: Partial<DraftItem>) => void; onLinks: (next: DraftLink[]) => void;
}) {
  const mine = links.filter((l) => l.source === item.ref);
  const incoming = links.filter((l) => l.target === item.ref);
  const label = (ref: string) => {
    const d = items.find((i) => i.ref === ref);
    if (d) return `${d.display_id ?? d.ref} · ${d.title}`;
    const e = existing.find((x) => x.id === ref);
    return e ? `${e.id} · ${e.title}` : ref;
  };
  const edited = item.current && (item.current.title !== item.title || item.current.text !== item.text || item.current.priority !== item.priority);
  return (
    <li id={`draft-item-${item.ref}`} onClick={onSelect}
      className={`flex flex-col gap-2 rounded-card border p-3 ${selected ? 'border-accent-text bg-accent-soft/20' : 'border-border bg-surface'} ${item.include ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={item.include} onChange={(e) => onPatch({ include: e.target.checked })} aria-label={`Включить: ${item.title}`} onClick={(e) => e.stopPropagation()} />
        <select value={item.type} onChange={(e) => onPatch({ type: e.target.value as ItemType })} className={`h-8 ${fieldClass}`} aria-label="Тип" onClick={(e) => e.stopPropagation()}>
          {(['US', 'FR', 'NFR', 'AC'] as const).map((t) => <option key={t} value={t}>{t} — {TYPE_LABEL[t]}</option>)}
        </select>
        <span className="font-mono text-meta text-text-muted">{item.display_id ?? 'новый ID'}</span>
        <Badge label={item.action === 'created' ? 'новый' : item.action === 'revised' ? 'новая ревизия' : 'без изменений'} tone={item.action === 'created' ? 'success' : item.action === 'revised' ? 'warning' : 'neutral'} />
        <Badge label={item.via === 'table' ? `строка ${item.line}` : item.verified ? 'цитата найдена' : 'цитата не найдена'} tone={item.via === 'table' || item.verified ? 'neutral' : 'warning'} />
      </div>
      <input value={item.title} onChange={(e) => onPatch({ title: e.target.value })} aria-label="Название" maxLength={300} className={`h-9 ${fieldClass} w-full font-medium`} />
      <textarea value={item.text} onChange={(e) => onPatch({ text: e.target.value })} aria-label="Формулировка" rows={2} placeholder="Формулировка (необязательно)" className={`${fieldClass} w-full py-1.5`} />
      <div className="flex flex-wrap items-center gap-3">
        {item.type !== 'AC' && (
          <label className="flex items-center gap-1.5 text-meta text-text-muted">Приоритет
            <select value={item.priority ?? ''} onChange={(e) => onPatch({ priority: e.target.value || null })} className={`h-8 ${fieldClass}`} onClick={(e) => e.stopPropagation()}>
              <option value="">не задан</option>
              {['P0', 'P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        {item.via === 'llm' && item.quote && (
          <p className="min-w-0 flex-1 text-meta text-text-muted">Цитата: «{item.quote.length > 140 ? `${item.quote.slice(0, 140)}…` : item.quote}»</p>
        )}
        {item.via === 'llm' && !item.quote && <p className="text-meta text-warning-text">Цитаты нет: выделите фразу в тексте справа и привяжите её.</p>}
      </div>
      {edited && item.current && (
        <p className="text-meta text-text-muted">Было: {item.current.title !== item.title && <>«{item.current.title}» </>}{item.current.text !== item.text && <>/ текст изменён </>}{item.current.priority !== item.priority && <>/ приоритет {item.current.priority ?? '—'} → {item.priority ?? '—'}</>}</p>
      )}
      <LinkEditor item={item} mine={mine} incoming={incoming} items={items} existing={existing} label={label} links={links} onLinks={onLinks} />
    </li>
  );
}

function LinkEditor({ item, mine, incoming, items, existing, label, links, onLinks }: {
  item: DraftItem; mine: DraftLink[]; incoming: DraftLink[]; items: DraftItem[]; existing: Target[]; label: (ref: string) => string;
  links: DraftLink[]; onLinks: (next: DraftLink[]) => void;
}) {
  const [type, setType] = useState<DraftLink['type']>('refines');
  const [query, setQuery] = useState('');
  const rule = LINK_RULES[type];
  const sourceOk = rule.source.includes(item.type);
  const q = query.trim().toLowerCase();
  const options: Target[] = [
    ...items.filter((i) => i.ref !== item.ref && i.include && rule.target.includes(i.type)).map((i) => ({ id: i.ref, type: i.type, title: `${i.display_id ?? i.ref} · ${i.title}` })),
    ...existing.filter((e) => rule.target.includes(e.type)).map((e) => ({ ...e, title: `${e.id} · ${e.title}` })),
  ].filter((o) => !mine.some((l) => l.type === type && l.target === o.id) && (!q || `${o.id} ${o.title}`.toLowerCase().includes(q))).slice(0, 8);
  const add = (target: string) => { onLinks([...links, { id: `m${Date.now()}${Math.random().toString(36).slice(2, 5)}`, type, source: item.ref, target, origin: 'manual' }]); setQuery(''); };
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-meta font-medium text-text">Связи</span>
      {mine.length === 0 && incoming.length === 0 && <span className="text-meta text-text-muted">Связей нет.</span>}
      <ul className="flex flex-col gap-1">
        {mine.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 text-meta">
            <Badge label={LINK_RULES[l.type].label} />
            <span className="min-w-0 flex-1 text-text">{label(l.target)}</span>
            {l.origin === 'basis' && <span className="text-text-muted">из столбца «Основание»</span>}
            <button type="button" aria-label="Убрать связь" className="text-text-muted hover:text-danger-text" onClick={() => onLinks(links.filter((x) => x.id !== l.id))}>×</button>
          </li>
        ))}
        {incoming.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 text-meta text-text-muted">
            <span>← {label(l.source)}</span><span>({LINK_RULES[l.type].label} этот элемент)</span>
          </li>
        ))}
      </ul>
      <div className="relative flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as DraftLink['type'])} className={`h-8 ${fieldClass} text-meta`} aria-label="Тип связи">
          {Object.entries(LINK_RULES).map(([t, r]) => <option key={t} value={t}>{r.label}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={sourceOk ? 'найти элемент по названию или ID' : `${item.type} не может так связываться`} disabled={!sourceOk}
          aria-label="Найти элемент для связи" className={`h-8 min-w-60 flex-1 ${fieldClass} text-meta`}
          onKeyDown={(e) => { if (e.key === 'Enter' && options[0]) { e.preventDefault(); add(options[0].id); } }} />
        {q && options.length > 0 && (
          <ul role="listbox" className="absolute left-0 top-9 z-30 max-h-64 w-full overflow-auto rounded-control border border-border bg-surface shadow-lg">
            {options.map((o) => (
              <li key={o.id} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); add(o.id); }} className="flex cursor-pointer gap-2 px-3 py-1.5 text-meta hover:bg-surface-muted">
                <span className="w-10 shrink-0 text-text-muted">{o.type}</span><span className="text-text">{o.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
