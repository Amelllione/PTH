import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Tabs } from '@/shared/ui';
import { Loaded, Section } from './common';
import { ArtifactCard } from './ArtifactCard';
import { DiffHunks } from './DiffView';
import { SourceMarkdown } from '@/features/source/SourceMarkdown';
import type { SourceFocus } from '@/shared/lib/sourceNav';
import type { SourceMark, SourceView } from '@/entities/pth/types';

type View = 'doc' | 'raw' | 'compare';
const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Источник: документ импорта как Markdown и как строки, подсветка формулировок, из которых получены требования, и сравнение версий. */
export function SourceScreen({ projectKey, focus }: { projectKey: string; focus: SourceFocus | null }) {
  const imports = useAsync(`imports-src:${projectKey}`, () => pthApi.imports(projectKey));
  const [uid, setUid] = useState<string | null>(focus?.uid ?? null);
  const [active, setActive] = useState<number | null>(focus?.line ?? null);
  const [view, setView] = useState<View>('doc');
  const [card, setCard] = useState<string | null>(null);
  const source = useAsync(uid ? `source:${projectKey}:${uid}` : null, () => pthApi.source(projectKey, uid ?? ''));
  useEffect(() => {
    if (focus) { setUid(focus.uid); setActive(focus.line); setCard(null); setView('doc'); }
  }, [focus]);
  // Новые импорты сверху: по умолчанию открывается самый свежий.
  const list = useMemo(() => (imports.data ?? []).filter((i) => i.uid).sort((a, b) => b.created_at.localeCompare(a.created_at)), [imports.data]);
  useEffect(() => {
    if (!uid && list.length > 0) setUid(list[0].uid);
  }, [uid, list]);

  if (card) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setCard(null)}>Назад к источнику</Button></div>
        <ArtifactCard key={card} projectKey={projectKey} displayId={card} onOpen={setCard} />
      </div>
    );
  }
  return (
    <Section title="Источник" hint="Документ, из которого получены требования. Подсвечены формулировки: у таблицы выделена строка и ячейки с текстом, у цитат модели абзац. Нажмите на подсвеченное, чтобы открыть требование; из карточки требования можно вернуться к источнику.">
      <Loaded state={imports} retry={imports.reload} empty={{ title: 'Источников нет', description: 'Загрузите спецификацию или выделите требования из текста моделью и примените черновик.', isEmpty: (d) => d.filter((i) => i.uid).length === 0 }}>
        {() => (
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Источник" value={uid ?? ''} onChange={(e) => { setUid(e.target.value || null); setActive(null); }}
              className="h-9 min-w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              {list.map((i) => <option key={i.uid ?? i.source_sha256} value={i.uid ?? ''}>{i.source_name} · {dateTime(i.created_at)}</option>)}
            </select>
            <Tabs label="Вид источника" idPrefix="source-view" selectedId={view} onChange={(id) => setView(id as View)}
              items={[{ id: 'doc', label: 'Документ' }, { id: 'raw', label: 'Исходник' }, { id: 'compare', label: 'Сравнение версий' }]} />
          </div>
        )}
      </Loaded>
      {uid && view === 'compare' && <Compare projectKey={projectKey} uid={uid} imports={list} onOpen={setCard} />}
      {uid && view !== 'compare' && (
        <Loaded state={source} retry={source.reload}>
          {(s) => <Viewer s={s} view={view} active={active} onActive={setActive} onOpen={setCard} />}
        </Loaded>
      )}
    </Section>
  );
}

const VIA: Record<string, string> = { table: 'таблица', llm: 'модель' };

function Viewer({ s, view, active, onActive, onOpen }: { s: SourceView; view: View; active: number | null; onActive: (n: number | null) => void; onOpen: (id: string) => void }) {
  const text = useMemo(() => s.lines.map((l) => l.text).join('\n'), [s]);
  const byLine = useMemo(() => {
    const map = new Map<number, SourceMark[]>();
    for (const m of s.marks) for (let n = m.line; n <= m.end_line; n++) map.set(n, [...(map.get(n) ?? []), m]);
    return map;
  }, [s]);
  useEffect(() => {
    if (view === 'raw' && active !== null) document.getElementById(`src-line-${active}`)?.scrollIntoView({ block: 'center' });
  }, [view, active]);
  return (
    <>
      <p className="text-meta text-text-muted">{s.source_name} · {dateTime(s.created_at)} · sha256 {s.source_sha256.slice(0, 16)}… · формулировок: {s.marks.length}</p>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="max-h-[75vh] overflow-auto rounded-card border border-border bg-surface p-4" aria-label="Содержимое источника">
          {view === 'doc' ? (
            <SourceMarkdown source={text} marks={s.marks} active={active} onOpen={onOpen} />
          ) : (
            <ol className="font-mono text-meta" aria-label="Строки источника">
              {s.lines.map((l) => {
                const marks = byLine.get(l.no) ?? [];
                const first = marks[0];
                const llm = first?.via === 'llm';
                return (
                  <li key={l.no} id={`src-line-${l.no}`}
                    className={`grid grid-cols-[3rem_1fr_auto] gap-2 border-l-4 px-2 py-0.5 text-text ${first ? `cursor-pointer ${llm ? 'border-dashed border-info-text' : 'border-accent-text/60 bg-accent-soft/30'} ${active === l.no ? 'outline outline-2 -outline-offset-2 outline-accent-text' : ''}` : 'border-transparent'}`}
                    onClick={first ? () => onOpen(first.display_id) : undefined}>
                    <span className="select-none text-right text-text-muted">{l.no}</span>
                    <span className="whitespace-pre-wrap break-all">{renderLine(l.text, l.no, marks)}</span>
                    {first && <span className="text-accent-text">{[...new Set(marks.map((m) => m.display_id))].join(', ')}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <aside className="flex max-h-[75vh] flex-col gap-1 overflow-auto rounded-card border border-border bg-surface p-3" aria-label="Требования источника">
          <h3 className="text-ui font-semibold">Требования в источнике: {s.marks.length}</h3>
          {s.marks.length === 0 && <p className="text-meta text-text-muted">Привязанных формулировок нет: требования из этого документа не создавались.</p>}
          <ul className="flex flex-col">
            {s.marks.map((m) => (
              <li key={`${m.display_id}:${m.line}`}>
                <button type="button" onClick={() => onActive(m.line)}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-control px-2 py-1 text-left text-meta hover:bg-surface-muted ${active === m.line ? 'bg-accent-soft text-accent-text' : 'text-text'}`}>
                  <span className="font-mono">{m.display_id}</span>
                  <span className="text-text-muted">{VIA[m.via]}, стр. {m.line}{m.end_line > m.line ? `–${m.end_line}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

/** Текст строки: у цитаты модели выделено ровно то место, которое она процитировала. */
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

/** Сравнение версий: выбранный источник считается новой версией, база выбирается из других импортов. */
function Compare({ projectKey, uid, imports, onOpen }: { projectKey: string; uid: string; imports: { uid: string | null; source_name: string; created_at: string }[]; onOpen: (id: string) => void }) {
  const current = imports.find((i) => i.uid === uid);
  // По умолчанию база — предыдущий импорт того же документа, иначе предыдущий по времени.
  const sameName = imports.filter((i) => i.uid !== uid && i.source_name === current?.source_name && (current?.created_at ?? '') > i.created_at);
  const earlier = imports.filter((i) => i.uid !== uid && (current?.created_at ?? '') > i.created_at);
  const [base, setBase] = useState<string>('');
  const baseUid = base || sameName[0]?.uid || earlier[0]?.uid || '';
  const cmp = useAsync(baseUid ? `source-cmp:${projectKey}:${baseUid}:${uid}` : null, () => pthApi.compareSources(projectKey, baseUid, uid));
  const others = imports.filter((i) => i.uid !== uid);
  if (others.length === 0) {
    return <InlineAlert tone="info" message="Версия одна. Импортируйте исправленный документ, и здесь появится сравнение." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-meta text-text-muted">С какой версией сравнить
          <select value={baseUid} onChange={(e) => setBase(e.target.value)} className="h-9 min-w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
            {others.map((i) => <option key={i.uid ?? ''} value={i.uid ?? ''}>{i.source_name} · {dateTime(i.created_at)}</option>)}
          </select>
        </label>
        <p className="pb-2 text-meta text-text-muted">Новая версия: {current?.source_name} · {current ? dateTime(current.created_at) : ''}</p>
      </div>
      {baseUid && (
        <Loaded state={cmp} retry={cmp.reload}>
          {(d) => (
            <>
              <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 text-ui">
                {d.identical ? <p>Версии совпадают построчно.</p> : (
                  <>
                    <p>Добавлено строк: <span className="text-success-text">+{d.added_lines}</span>, убрано: <span className="text-danger-text">−{d.removed_lines}</span>.</p>
                    <ReqList label="Изменились формулировки" ids={d.requirements.changed} onOpen={onOpen} />
                    <ReqList label="Появились в новой версии" ids={d.requirements.added} onOpen={onOpen} />
                    <ReqList label="Пропали из новой версии" ids={d.requirements.removed} onOpen={onOpen} />
                    {d.requirements.changed.length + d.requirements.added.length + d.requirements.removed.length === 0 && <p className="text-text-muted">Изменения не затрагивают формулировки требований.</p>}
                  </>
                )}
              </div>
              {d.hunks.length > 0 && <DiffHunks hunks={d.hunks} />}
            </>
          )}
        </Loaded>
      )}
    </div>
  );
}

function ReqList({ label, ids, onOpen }: { label: string; ids: string[]; onOpen: (id: string) => void }) {
  if (ids.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-text-muted">{label}: {ids.length}</span>
      {ids.map((id) => <button key={id} type="button" onClick={() => onOpen(id)} className="font-mono text-meta text-accent-text underline underline-offset-2">{id}</button>)}
    </p>
  );
}
