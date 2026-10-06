import { useState, type ChangeEvent, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Tabs, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText, usePaged } from './common';
import { ArtifactCard } from './ArtifactCard';
import { CopyId } from '@/shared/ui/CopyId';
import { DiagramView, formatOf, type DiagramFormat } from '@/features/diagrams/DiagramView';
import { ProcessPicker } from '@/features/diagrams/ProcessPicker';
import { formatSvg, tidyMermaid } from '@/features/diagrams/format';
import type { ArtifactDetail, RevisionItem } from '@/entities/pth/types';

const EXAMPLE = `flowchart LR
  A[Пользователь добавляет товар] --> B{Товар в наличии?}
  B -- да --> C[Оформление заказа]
  B -- нет --> D[Сообщение об ожидании]
  C --> E[Оплата]`;

const FORMAT_LABEL: Record<DiagramFormat, string> = { mermaid: 'Mermaid', svg: 'SVG' };
const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Схемы процессов: Mermaid или векторный SVG, каждая привязана к процессу — US или ФТ, которая его описывает. */
export function DiagramsScreen({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const data = useAsync(`diagrams:${projectKey}:${version}`, async () => {
    const [list, relations] = await Promise.all([pthApi.artifactsPage(projectKey, 0, 500, 'DIAGRAM'), pthApi.relations(projectKey)]);
    const processes: Record<string, string[]> = {};
    for (const r of relations) if (r.type === 'illustrates') (processes[r.source] ??= []).push(r.target);
    return { items: list.items, processes };
  });
  if (creating) return <CreateDiagram projectKey={projectKey} onDone={(id) => { setCreating(false); setVersion((v) => v + 1); if (id) setOpen(id); }} />;
  if (open) return <DiagramCard projectKey={projectKey} id={open} onBack={() => { setOpen(null); setVersion((v) => v + 1); }} />;
  return (
    <Section title="Схемы" hint="Схема показывает процесс и привязана к US или ФТ, которая этот процесс описывает. Формат: Mermaid (текст) или SVG (векторный файл). Изменили процесс, и схема попадёт в «Влияние».">
      <div><Button variant="secondary" size="sm" onClick={() => setCreating(true)}>Добавить схему</Button></div>
      <Loaded state={data} retry={data.reload} empty={{ title: 'Схем нет', description: 'Добавьте схему и привяжите её к процессу.', isEmpty: (d) => d.items.length === 0 }}>
        {(d) => <DiagramList items={d.items} processes={d.processes} onOpen={setOpen} />}
      </Loaded>
    </Section>
  );
}

function DiagramList({ items, processes, onOpen }: { items: { display_id: string; title: string; revision: number }[]; processes: Record<string, string[]>; onOpen: (id: string) => void }) {
  const paged = usePaged(items, 20, 'Страницы схем');
  return (
    <DataTable caption="Схемы" columns="10rem minmax(0,1.4fr) minmax(0,1fr) 5rem" headers={['Схема', 'Название', 'Процесс', 'Ревизия']}
      onRowSelect={(i) => onOpen(paged.rows[i].display_id)} footer={paged.pager}
      rows={paged.rows.map((r) => [
        <CopyId key="i" value={r.display_id} className="font-mono text-meta">{r.display_id}</CopyId>, r.title,
        processes[r.display_id]?.length ? <span key="p" className="font-mono text-meta">{processes[r.display_id].join(', ')}</span> : <StatusText key="p" label="не привязана" tone="warn" />,
        String(r.revision),
      ])} />
  );
}

function DiagramCard({ projectKey, id, onBack }: { projectKey: string; id: string; onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<'card' | 'edit'>('card');
  const card = useAsync(`diagram:${projectKey}:${id}:${version}`, () => pthApi.artifact(projectKey, id));
  const revisions = useAsync(`diagram-revs:${projectKey}:${id}:${version}`, () => pthApi.revisions(projectKey, id));
  const [shownRev, setShownRev] = useState<number | null>(null);
  const [base, setBase] = useState<{ title: string; text: string } | null>(null);
  const [link, setLink] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [process, setProcess] = useState<string | null>(null);
  if (process) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setProcess(null)}>Назад к схеме</Button></div>
        <ArtifactCard key={process} projectKey={projectKey} displayId={process} onOpen={setProcess} />
      </div>
    );
  }
  const attach = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      for (const target of link) await pthApi.createRelation(projectKey, { type: 'illustrates', source: id, target });
      setLink([]);
      setVersion((v) => v + 1);
    } catch (err) { setError(errText(err, 'Не удалось привязать')); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={onBack}>Назад к схемам</Button></div>
      <Loaded state={card} retry={card.reload}>
        {(c) => (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-section font-semibold text-text">{c.title}</h2>
              <span className="text-meta text-text-muted">{FORMAT_LABEL[formatOf(c.attributes)]} · ревизия {c.revision}</span>
            </div>
            <Tabs label="Разделы схемы" idPrefix="diagram" selectedId={tab} onChange={(v) => setTab(v as typeof tab)}
              items={[{ id: 'card', label: 'Карточка' }, { id: 'edit', label: 'Редактирование' }]} />
            <div role="tabpanel" id={`diagram-panel-${tab}`} aria-labelledby={`diagram-tab-${tab}`} className="flex flex-col gap-4">
              {tab === 'card' ? (
                <>
                  <Loaded state={revisions} retry={revisions.reload}>
                    {(revs) => {
                      const shown = revs.find((r) => r.number === shownRev) ?? revs[revs.length - 1];
                      const old = shown.number !== c.revision;
                      return (
                        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                          {old && (
                            <InlineAlert tone="warning" message={`Показана ревизия ${shown.number} из ${c.revision}, не текущая.`} />
                          )}
                          <DiagramView format={formatOf(c.attributes)} source={shown.text} title={shown.title} />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => download(shown.title, shown.text, formatOf(c.attributes))}>Скачать файл</Button>
                            {old && <Button size="sm" variant="secondary" onClick={() => setShownRev(null)}>К текущей ревизии</Button>}
                            {old && <Button size="sm" variant="secondary" onClick={() => { setBase({ title: shown.title, text: shown.text }); setTab('edit'); }}>Взять за основу для правки</Button>}
                          </div>
                        </div>
                      );
                    }}
                  </Loaded>
                  <Section title="Процессы" hint="US или ФТ, которые описывают процесс на схеме.">
                    <Processes projectKey={projectKey} id={id} version={version} onOpen={setProcess} />
                    <form onSubmit={attach} className="flex flex-col gap-2" aria-label="Привязка схемы к процессу">
                      <ProcessPicker projectKey={projectKey} value={link} onChange={setLink} label="Привязать к процессу" />
                      <div><Button type="submit" variant="secondary" disabled={link.length === 0}>Привязать</Button></div>
                    </form>
                    {error && <InlineAlert tone="danger" message={error} />}
                  </Section>
                  <Section title="Ревизии" hint="Выберите ревизию, чтобы увидеть, как выглядела схема. Из старой ревизии можно начать правку.">
                    <Loaded state={revisions} retry={revisions.reload}>
                      {(revs) => <RevisionPicker revs={revs} current={c.revision} shown={shownRev ?? c.revision} onShow={(n) => setShownRev(n === c.revision ? null : n)} />}
                    </Loaded>
                  </Section>
                </>
              ) : (
                <DiagramEditor key={base?.text ?? 'current'} projectKey={projectKey} card={c} base={base} onSaved={() => { setBase(null); setShownRev(null); setVersion((v) => v + 1); setTab('card'); }} />
              )}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

/** Редактирование схемы: название и исходник с живым просмотром; SVG и Mermaid можно привести к аккуратному виду. */
function DiagramEditor({ projectKey, card, base, onSaved }: { projectKey: string; card: ArtifactDetail; base: { title: string; text: string } | null; onSaved: () => void }) {
  const format = formatOf(card.attributes);
  const [title, setTitle] = useState(base?.title ?? card.title);
  // SVG в одну строку править неудобно: при открытии расставляем структуру, если разметка корректна.
  const initial = base?.text ?? card.text;
  const structured = format === 'svg' ? formatSvg(initial) : null;
  const [source, setSource] = useState(structured ?? initial);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(structured && structured !== initial ? 'Структура SVG расставлена автоматически: по одному элементу на строку.' : null);
  const [busy, setBusy] = useState(false);
  const loaded = structured ?? initial;
  const changed = title !== card.title || source !== card.text;
  const edited = title !== (base?.title ?? card.title) || source !== loaded;
  const tidy = () => {
    setNote(null); setError(null);
    if (format === 'svg') {
      const out = formatSvg(source);
      if (out === null) { setError('SVG не разбирается как XML: отступы расставить нельзя, сначала исправьте разметку.'); return; }
      setSource(out);
    } else {
      setSource(tidyMermaid(source));
    }
    setNote('Отступы приведены в порядок');
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setNote(null);
    try {
      await pthApi.addRevision(projectKey, card.display_id, { title: title.trim(), text: (format === 'svg' ? formatSvg(source) : null) ?? source, attributes: card.attributes, exemption_reason: card.exemption_reason });
      onSaved();
    } catch (err) { setError(errText(err, 'Не удалось сохранить')); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Редактирование схемы">
      <TextField label="Название" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full max-w-xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-3"><span className="text-ui font-medium text-text">Исходник</span><span className="text-meta text-text-muted">{format === 'svg' ? 'SVG' : 'Mermaid'}</span></span>
          <textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} wrap="off" rows={20}
            className="min-h-80 flex-1 resize-y overflow-auto rounded-control border border-control-border bg-surface p-2 font-mono text-meta leading-5 text-text [tab-size:2]" />
        </label>
        <PreviewPane format={format} source={source} title={title} />
      </div>
      <p className="text-meta text-text-muted">{format === 'svg' ? 'SVG выводится как изображение: скрипты, обработчики событий и DOCTYPE не допускаются.' : 'Синтаксис проверяется при просмотре: ошибка Mermaid показана справа.'} Сохранение создаёт новую ревизию.</p>
      {error && <InlineAlert tone="danger" message={error} />}
      {note && <InlineAlert tone="success" message={note} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={tidy}>Привести отступы</Button>
        <Button type="button" variant="secondary" disabled={!edited} onClick={() => { setTitle(base?.title ?? card.title); setSource(loaded); setError(null); setNote(null); }}>Отменить правки</Button>
        <Button type="submit" variant="primary" disabled={busy || !changed || !title.trim() || !source.trim()} loading={busy}>Сохранить</Button>
      </div>
    </form>
  );
}

function Processes({ projectKey, id, version, onOpen }: { projectKey: string; id: string; version: number; onOpen: (id: string) => void }) {
  const titles = useAsync(`diagram-proc:${projectKey}:${id}:${version}`, async () => {
    const all = await pthApi.relations(projectKey);
    const ids = all.filter((r) => r.type === 'illustrates' && r.source === id).map((r) => r.target);
    return Promise.all(ids.map(async (t) => ({ id: t, title: (await pthApi.artifact(projectKey, t)).title })));
  });
  return (
    <Loaded state={titles} retry={titles.reload} empty={{ title: 'Не привязана', description: 'Привяжите схему к US или ФТ ниже.', isEmpty: (d) => d.length === 0 }}>
      {(rows) => (
        <DataTable caption="Процессы схемы" columns="9rem minmax(0,1fr)" headers={['Процесс', 'Описание']} onRowSelect={(i) => onOpen(rows[i].id)}
          rows={rows.map((r) => [<span key="i" className="font-mono text-meta text-accent-text">{r.id}</span>, r.title])} />
      )}
    </Loaded>
  );
}

function download(title: string, text: string, format: DiagramFormat) {
  const type = format === 'svg' ? 'image/svg+xml' : 'text/plain';
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.${format === 'svg' ? 'svg' : 'mmd'}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CreateDiagram({ projectKey, onDone }: { projectKey: string; onDone: (id: string | null) => void }) {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<DiagramFormat>('mermaid');
  const [source, setSource] = useState(EXAMPLE);
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const isSvg = file.name.toLowerCase().endsWith('.svg');
    setSource((isSvg ? formatSvg(text) : null) ?? text);
    setFormat(isSvg ? 'svg' : 'mermaid');
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let created: string | null = null;
    try {
      created = (await pthApi.createArtifact(projectKey, { type: 'DIAGRAM', title: title.trim(), text: (format === 'svg' ? formatSvg(source) : null) ?? source, attributes: { format } })).display_id;
      for (const target of ids) await pthApi.createRelation(projectKey, { type: 'illustrates', source: created, target });
      onDone(created);
    } catch (err) {
      setError(created ? `Схема ${created} создана, но привязать не удалось: ${errText(err, '')}. Привяжите на карточке схемы.` : errText(err, 'Не удалось создать схему'));
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={() => onDone(null)}>Назад к схемам</Button></div>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Новая схема">
        <h2 className="text-section font-semibold text-text">Новая схема</h2>
        <div className="flex flex-wrap items-end gap-3">
          <TextField label="Название" hint="какой процесс показывает" value={title} onChange={(e) => setTitle(e.target.value)} className="w-96" />
          <label className="flex flex-col gap-1 text-meta text-text-muted">Формат
            <select value={format} onChange={(e) => setFormat(e.target.value as DiagramFormat)} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="mermaid">Mermaid (текст)</option>
              <option value="svg">SVG (векторный файл)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-meta text-text-muted">Загрузить файл
            <input type="file" accept=".svg,.mmd,.mermaid,.txt" onChange={(e) => void onFile(e)} className="text-ui text-text" />
          </label>
        </div>
        <ProcessPicker projectKey={projectKey} value={ids} onChange={setIds} hint="введите название или ID US или ФТ, которая описывает процесс" />
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-3"><span className="text-ui font-medium text-text">Исходник</span><span className="text-meta text-text-muted">{format === 'svg' ? 'SVG' : 'Mermaid'}</span></span>
            <textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} wrap="off" rows={16}
              className="min-h-80 flex-1 resize-y overflow-auto rounded-control border border-control-border bg-surface p-2 font-mono text-meta leading-5 text-text [tab-size:2]" />
          </label>
          <PreviewPane format={format} source={source} title={title || 'Схема'} />
        </div>
        <p className="text-meta text-text-muted">SVG выводится как изображение: скрипты, обработчики событий и DOCTYPE в нём не допускаются. Без привязки к процессу схема попадёт в замечания.</p>
        {error && <InlineAlert tone="danger" message={error} />}
        <div><Button type="submit" variant="primary" disabled={busy || !title.trim() || !source.trim()} loading={busy}>Создать схему</Button></div>
      </form>
    </div>
  );
}

const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Список ревизий: что изменилось относительно предыдущей и кнопка показа. Сам код схемы не выводится. */
function RevisionPicker({ revs, current, shown, onShow }: { revs: RevisionItem[]; current: number; shown: number; onShow: (n: number) => void }) {
  const ordered = [...revs].sort((a, b) => b.number - a.number);
  return (
    <ul className="flex flex-col gap-2" aria-label="Ревизии схемы">
      {ordered.map((r, i) => {
        const prev = ordered[i + 1];
        const what = !prev ? 'первая ревизия' : [prev.title !== r.title && 'название', prev.text !== r.text && 'схема'].filter(Boolean).join(' и ') || 'без изменений';
        return (
          <li key={r.number} className={`flex flex-wrap items-center justify-between gap-2 rounded-control border px-3 py-2 ${r.number === shown ? 'border-focus bg-accent-soft/40' : 'border-border'}`}>
            <span className="flex flex-col">
              <span className="text-ui font-medium text-text">ревизия {r.number}{r.number === current ? ' (текущая)' : ''}</span>
              <span className="text-meta text-text-muted">{dateTime(r.created_at)} · {prev ? `изменено: ${what}` : what}</span>
            </span>
            <Button size="sm" variant="secondary" aria-pressed={r.number === shown} disabled={r.number === shown} onClick={() => onShow(r.number)}>{r.number === shown ? 'Показана' : 'Показать'}</Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Правая колонка редактора: подпись той же строки, что у исходника, и поле просмотра той же высоты, чтобы края совпадали. */
function PreviewPane({ format, source, title }: { format: DiagramFormat; source: string; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-3"><span className="text-ui font-medium text-text">Просмотр</span><span className="text-meta text-text-muted">обновляется при вводе</span></span>
      <div className="min-h-80 flex-1 [&>*]:h-full [&>*]:min-h-80">
        {source.trim() ? <DiagramView format={format} source={source} title={title} /> : <p className="rounded-control border border-border p-3 text-ui text-text-muted">Исходник пуст.</p>}
      </div>
    </div>
  );
}
