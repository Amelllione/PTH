import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Tabs } from '@/shared/ui';
import { SourceMarkdown } from '@/features/source/SourceMarkdown';
import type { SourceMark } from '@/entities/pth/types';

/** Исходный текст с подсветкой: строки таблицы и цитаты модели. Выделенный мышью кусок можно сделать цитатой выбранного элемента. */
export function SourcePane({ text, marks, active, activeLabel, onSelect, onQuote }: {
  text: string;
  marks: SourceMark[];
  /** ref выбранного элемента: его фрагмент подсвечен ярче, к нему идёт прокрутка. */
  active: string | null;
  activeLabel?: string;
  onSelect: (ref: string) => void;
  /** Выделенный в тексте кусок как цитата выбранного элемента. Без обработчика кнопки нет. */
  onQuote?: (quote: string) => void;
}) {
  const [view, setView] = useState<'doc' | 'raw'>('doc');
  const [picked, setPicked] = useState('');
  const activeLine = useMemo(() => marks.find((m) => m.display_id === active)?.line ?? null, [marks, active]);
  const lines = useMemo(() => text.split('\n'), [text]);
  const byLine = useMemo(() => {
    const map = new Map<number, SourceMark[]>();
    for (const m of marks) for (let n = m.line; n <= m.end_line; n++) map.set(n, [...(map.get(n) ?? []), m]);
    return map;
  }, [marks]);
  useEffect(() => {
    if (view === 'raw' && activeLine !== null) document.getElementById(`src-line-${activeLine}`)?.scrollIntoView({ block: 'center' });
  }, [view, activeLine]);

  const captureSelection = () => setPicked((window.getSelection()?.toString() ?? '').replace(/\s+/g, ' ').trim());
  return (
    <div className="flex flex-col gap-2" aria-label="Исходный текст">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Вид текста" idPrefix="draft-source" selectedId={view} onChange={(id) => setView(id as typeof view)}
          items={[{ id: 'doc', label: 'Документ' }, { id: 'raw', label: 'Исходник' }]} />
        <span className="text-meta text-text-muted">подсвечено фрагментов: {marks.length}</span>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-card border border-border bg-surface p-4" onMouseUp={captureSelection} onKeyUp={captureSelection}>
        {view === 'doc' ? (
          <SourceMarkdown source={text} marks={marks} active={activeLine} onOpen={onSelect} />
        ) : (
          <ol className="font-mono text-meta" aria-label="Строки текста">
            {lines.map((line, i) => {
              const no = i + 1;
              const here = byLine.get(no) ?? [];
              const first = here[0];
              const llm = first?.via === 'llm';
              return (
                <li key={no} id={`src-line-${no}`}
                  className={`grid grid-cols-[3rem_1fr_auto] gap-2 border-l-4 px-2 py-0.5 text-text ${first ? `cursor-pointer ${llm ? 'border-dashed border-info-text' : 'border-accent-text/60 bg-accent-soft/30'} ${activeLine === no ? 'outline outline-2 -outline-offset-2 outline-accent-text' : ''}` : 'border-transparent'}`}
                  onClick={first ? () => onSelect(first.display_id) : undefined}>
                  <span className="select-none text-right text-text-muted">{no}</span>
                  <span className="whitespace-pre-wrap break-all">{renderLine(line, no, here)}</span>
                  {first && <span className="select-none text-accent-text">{[...new Set(here.map((m) => m.display_id))].join(', ')}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {onQuote && (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-muted/40 px-3 py-2 text-meta">
          {picked ? (
            <>
              <span className="min-w-0 flex-1 truncate text-text">Выделено: «{picked.length > 90 ? `${picked.slice(0, 90)}…` : picked}»</span>
              <Button size="sm" variant="secondary" disabled={!active} onClick={() => { onQuote(picked); setPicked(''); window.getSelection()?.removeAllRanges(); }}>
                {active ? `Сделать цитатой: ${activeLabel ?? active}` : 'Сначала выберите элемент слева'}
              </Button>
            </>
          ) : <span className="text-text-muted">Выделите мышью фразу в тексте (лучше на вкладке «Исходник»), чтобы привязать её к выбранному элементу как цитату.</span>}
        </div>
      )}
    </div>
  );
}

function renderLine(text: string, no: number, marks: SourceMark[]): ReactNode {
  const quote = marks.find((m) => m.via === 'llm' && m.start_col !== null && m.start_col !== undefined);
  if (!quote) return text || ' ';
  const from = no === quote.line ? (quote.start_col ?? 0) : 0;
  const to = no === quote.end_line ? (quote.end_col ?? text.length) : text.length;
  return (
    <>
      {text.slice(0, from)}
      <mark className={`rounded-sm px-0.5 text-text ${quote.verified === false ? 'bg-[color-mix(in_srgb,var(--warning-text)_30%,transparent)]' : 'bg-[color-mix(in_srgb,var(--info-text)_30%,transparent)]'}`}>{text.slice(from, to)}</mark>
      {text.slice(to)}
    </>
  );
}
