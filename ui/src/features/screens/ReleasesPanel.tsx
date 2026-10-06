import { useState, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Markdown, Tabs, TextField, Tooltip } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText, usePaged } from './common';
import { CopyId } from '@/shared/ui/CopyId';
import { ArtifactCard } from './ArtifactCard';
import type { ReleaseComparison, ReleaseDetail, ReleaseProgress, ReleaseStage, ReleaseSummary } from '@/entities/pth/types';

const STATUS_RU: Record<string, string> = { planned: 'планируется', frozen: 'зафиксирован', released: 'выпущен', cancelled: 'отменён' };
const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral' | 'info'> = { planned: 'info', frozen: 'warn', released: 'ok', cancelled: 'neutral' };
const STAGE: Record<ReleaseStage, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  verified: { label: 'реализовано и проверено', tone: 'ok' },
  implemented: { label: 'реализовано, не проверено', tone: 'warn' },
  not_started: { label: 'не реализовано', tone: 'neutral' },
  failed: { label: 'проверка упала', tone: 'bad' },
  excluded: { label: 'исключено', tone: 'neutral' },
  no_requirements: { label: 'нет ФТ в составе', tone: 'warn' },
};
const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Релизы: список, создание и карточка с составом, продвижением и выпуском. */
export function ReleasesPanel({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const list = useAsync(`releases:${projectKey}:${version}`, () => pthApi.releases(projectKey));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (open) return <ReleaseView projectKey={projectKey} uid={open} onBack={() => { setOpen(null); setVersion((v) => v + 1); }} />;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rel = await pthApi.createRelease(projectKey, { name: name.trim(), description: description.trim() });
      setName(''); setDescription('');
      setOpen(rel.uid);
    } catch (err) {
      setError(errText(err, 'Не удалось создать релиз'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Релизы" hint="Релиз — заранее набранный состав: user story и требования со связями. Состав фиксируется, по нему идёт отслеживание реализации и проверки, выпуск делается по тегу репозитория.">
        <Loaded state={list} retry={list.reload} empty={{ title: 'Релизов нет', description: 'Создайте релиз ниже и наберите в него состав.', isEmpty: (d) => d.length === 0 }}>
          {(rows) => (
            <DataTable caption="Релизы" columns="minmax(0,1fr) 9rem 8rem minmax(0,1.2fr) 9rem" headers={['Релиз', 'Статус', 'Тег', 'Продвижение', 'Состав']}
              onRowSelect={(i) => setOpen(rows[i].uid)}
              rows={rows.map((r) => [
                <span key="n" className="flex flex-col"><span className="text-ui font-medium text-text">{r.name}</span>{r.description && <span className="text-meta text-text-muted">{r.description}</span>}</span>,
                <StatusText key="s" label={STATUS_RU[r.status]} tone={STATUS_TONE[r.status]} />,
                <span key="t" className="font-mono text-meta">{r.tag ?? '—'}</span>,
                <ProgressBar key="p" percent={r.progress.percent} label={`${r.progress.done} из ${r.progress.total}`} />,
                `${r.progress.total} элементов`,
              ])} />
          )}
        </Loaded>
      </Section>
      <Loaded state={list} retry={list.reload}>
        {(rows) => rows.length >= 2 ? <CompareReleases projectKey={projectKey} releases={rows} /> : null}
      </Loaded>
      <form onSubmit={create} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Новый релиз">
        <h3 className="text-ui font-semibold">Новый релиз</h3>
        <div className="flex flex-wrap items-end gap-3">
          <TextField label="Название" hint="например 0.2 или «MVP»" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
          <TextField label="Цель релиза" hint="необязательно" value={description} onChange={(e) => setDescription(e.target.value)} className="w-96" />
          <Button type="submit" variant="primary" disabled={!name.trim() || busy} loading={busy}>Создать</Button>
        </div>
        {error && <InlineAlert tone="danger" message={error} />}
      </form>
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <span className="flex flex-col gap-1" role="img" aria-label={`${percent}%, ${label}`}>
      <span className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"><span className="block h-full bg-success-text" style={{ width: `${percent}%` }} /></span>
      <span className="text-meta text-text-muted">{percent}% · {label}</span>
    </span>
  );
}

function ReleaseView({ projectKey, uid, onBack }: { projectKey: string; uid: string; onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const rel = useAsync(`release:${projectKey}:${uid}:${version}`, () => pthApi.release(projectKey, uid));
  const [tab, setTab] = useState<'scope' | 'issue' | 'report'>('scope');
  const [card, setCard] = useState<string | null>(null);
  const reload = () => setVersion((v) => v + 1);
  if (card) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setCard(null)}>Назад к релизу</Button></div>
        <ArtifactCard key={card} projectKey={projectKey} displayId={card} onOpen={setCard} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={onBack}>Назад к релизам</Button></div>
      <Loaded state={rel} retry={rel.reload}>
        {(r) => (
          <>
            <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-section font-semibold text-text">Релиз {r.name}</h2>
                <StatusText label={STATUS_RU[r.status]} tone={STATUS_TONE[r.status]} />
              </div>
              {r.description && <p className="text-ui text-text-muted">{r.description}</p>}
              <ProgressBar percent={r.progress.percent} label={`${r.progress.done} из ${r.progress.total} готово`} />
              <p className="text-meta text-text-muted">
                {Object.entries(r.progress.counts).map(([s, n]) => `${STAGE[s as ReleaseStage]?.label ?? s}: ${n}`).join(' · ') || 'состав пуст'}
              </p>
            </div>
            <Tabs label="Разделы релиза" idPrefix="rel-view" selectedId={tab} onChange={(id) => setTab(id as typeof tab)}
              items={[{ id: 'scope', label: 'Состав и продвижение' }, { id: 'issue', label: 'Фиксация и выпуск' }, { id: 'report', label: 'Отчёт' }]} />
            <div role="tabpanel" id={`rel-view-panel-${tab}`} aria-labelledby={`rel-view-tab-${tab}`}>
              {tab === 'scope' ? <ScopeTab projectKey={projectKey} r={r} onChanged={reload} onOpen={setCard} /> : tab === 'issue' ? <IssueTab projectKey={projectKey} r={r} onChanged={reload} /> : <ReportTab projectKey={projectKey} r={r} />}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

function ScopeTab({ projectKey, r, onChanged, onOpen }: { projectKey: string; r: ReleaseDetail; onChanged: () => void; onOpen: (id: string) => void }) {
  const editable = r.status === 'planned';
  const p = r.progress;
  const paged = usePaged(p.items, 20, 'Страницы состава');
  const [error, setError] = useState<string | null>(null);
  const remove = async (id: string, related: boolean) => {
    setError(null);
    try { await pthApi.removeReleaseItem(projectKey, r.uid, id, related); onChanged(); } catch (err) { setError(errText(err, 'Не удалось убрать')); }
  };
  return (
    <div className="flex flex-col gap-4">
      {p.changed_after_freeze.length > 0 && (
        <InlineAlert tone="warning" message={`После фиксации изменены: ${p.changed_after_freeze.join(', ')}. Проверьте, что реализация и тесты соответствуют новой ревизии.`} />
      )}
      {error && <InlineAlert tone="danger" message={error} />}
      {p.without_story.length > 0 && (
        <InlineAlert tone="warning" message={`Взяты без user story: ${p.without_story.length} (${p.without_story.join(', ')}). В USM таких требований нет: карточка US показывает только свои.`} />
      )}
      <Section title="Состав" hint="Стадия: реализовано — есть коммит с implements; проверено — тесты прошли. У user story стадия считается по её требованиям из состава.">
        {p.items.length === 0 ? <p className="text-ui text-text-muted">В релизе пока ничего нет.{editable ? ' Добавьте user story ниже, вместе с ними возьмутся уточняющие требования.' : ''}</p> : (
          <DataTable caption="Состав релиза" columns={editable ? '8rem minmax(0,1.3fr) 4rem 12rem minmax(0,1fr) 7rem' : '8rem minmax(0,1.3fr) 4rem 12rem minmax(0,1fr)'}
            headers={editable ? ['Элемент', 'Название', 'Приор.', 'Стадия', 'Коммиты', ''] : ['Элемент', 'Название', 'Приор.', 'Стадия', 'Коммиты']}
            onRowSelect={(i) => onOpen(paged.rows[i].display_id)} footer={paged.pager}
            rowClassName={(i) => (paged.rows[i].without_story ? 'bg-[color-mix(in_srgb,var(--warning-text)_12%,transparent)]' : undefined)}
            rows={paged.rows.map((i) => [
              <span key="i" className="flex flex-col"><CopyId value={i.display_id} className="font-mono text-meta">{i.display_id}</CopyId><span className="text-meta text-text-muted">{i.via === 'related' ? 'вместе со связью' : i.type}</span>{i.without_story && <WithoutStory stories={i.stories} missing={i.stories_missing} />}</span>,
              <span key="t">{i.title}{i.changed && <span className="block text-meta text-warning-text">изменено после фиксации (ревизия {i.frozen_revision} → {i.revision})</span>}</span>,
              i.priority ?? '—',
              <StatusText key="s" label={STAGE[i.stage].label} tone={STAGE[i.stage].tone} />,
              <span key="c" className="font-mono text-meta">{i.code.join(', ') || '—'}</span>,
              ...(editable ? [<span key="a" className="flex flex-col items-start gap-1">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void remove(i.display_id, false); }}>Убрать</Button>
                {i.type === 'US' && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void remove(i.display_id, true); }}>Со связями</Button>}
              </span>] : []),
            ])} />
        )}
      </Section>
      {editable && <AddItems projectKey={projectKey} r={r} onAdded={onChanged} />}
    </div>
  );
}

/** Набор состава: выбор user story и требований из реестра, по умолчанию вместе с уточняющими. */
function AddItems({ projectKey, r, onAdded }: { projectKey: string; r: ReleaseDetail; onAdded: () => void }) {
  const [type, setType] = useState('US');
  const [filter, setFilter] = useState('');
  const [related, setRelated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const list = useAsync(`release-candidates:${projectKey}:${type}`, () => pthApi.artifactsPage(projectKey, 0, 500, type));
  const inRelease = new Set(r.progress.items.map((i) => i.display_id));
  const add = async (ids: string[]) => {
    setError(null); setNote(null);
    try {
      const out = await pthApi.addReleaseItems(projectKey, r.uid, ids, related);
      setNote(`Добавлено: ${out.added.length}${out.added.length > ids.length ? ` (вместе со связями)` : ''}`);
      onAdded();
    } catch (err) { setError(errText(err, 'Не удалось добавить')); }
  };
  return (
    <Section title="Добавить в релиз" hint="Берите user story: уточняющие ФТ, НФТ и AC придут вместе с ней, если отмечено «со связями».">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-meta text-text-muted">Тип
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
            {['US', 'FR', 'NFR', 'AC'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <TextField label="Поиск" hint="по ID и названию" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-72" />
        <label className="flex items-center gap-2 pb-2 text-ui text-text"><input type="checkbox" checked={related} onChange={(e) => setRelated(e.target.checked)} />со связями (уточняющие требования)</label>
      </div>
      {error && <InlineAlert tone="danger" message={error} />}
      {note && <InlineAlert tone="success" message={note} />}
      <Loaded state={list} retry={list.reload}>
        {({ items }) => <Candidates items={items.filter((i) => !inRelease.has(i.display_id) && `${i.display_id} ${i.title}`.toLowerCase().includes(filter.trim().toLowerCase()))} onAdd={add} />}
      </Loaded>
    </Section>
  );
}

function Candidates({ items, onAdd }: { items: { display_id: string; title: string }[]; onAdd: (ids: string[]) => void }) {
  const paged = usePaged(items, 20, 'Страницы кандидатов');
  if (items.length === 0) return <p className="text-ui text-text-muted">Подходящих элементов нет: всё уже в релизе или фильтр ничего не нашёл.</p>;
  return (
    <DataTable caption="Кандидаты в релиз" columns="8rem minmax(0,1fr) 7rem" headers={['Элемент', 'Название', '']} footer={paged.pager}
      rows={paged.rows.map((i) => [
        <span key="i" className="font-mono text-meta">{i.display_id}</span>, i.title,
        <Button key="a" size="sm" variant="secondary" onClick={() => onAdd([i.display_id])}>Добавить</Button>,
      ])} />
  );
}

function IssueTab({ projectKey, r, onChanged }: { projectKey: string; r: ReleaseDetail; onChanged: () => void }) {
  const [tag, setTag] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (action: 'freeze' | 'unfreeze' | 'release' | 'cancel', body?: { reason?: string; tag?: string }) => {
    setBusy(true); setError(null);
    try { await pthApi.releaseAction(projectKey, r.uid, action, body); setReason(''); onChanged(); } catch (err) { setError(errText(err, 'Не удалось выполнить')); } finally { setBusy(false); }
  };
  const blockers = r.progress.blockers;
  const box = 'flex flex-col gap-3 rounded-card border border-border bg-surface p-4';
  return (
    <div className="flex flex-col gap-4">
      {error && <InlineAlert tone="danger" message={error} />}
      {r.status === 'planned' && (
        <div className={box}>
          <h3 className="text-ui font-semibold">Зафиксировать состав</h3>
          <p className="text-ui text-text-muted">После фиксации состав нельзя менять: запоминаются ревизии элементов, дальше отслеживается продвижение. Если элемент изменят позже, релиз покажет это.</p>
          <div><Button variant="primary" disabled={busy || r.progress.total === 0} onClick={() => void act('freeze')}>Зафиксировать ({r.progress.total})</Button></div>
        </div>
      )}
      {r.status === 'frozen' && (
        <>
          <div className={box}>
            <h3 className="text-ui font-semibold">Готовность к выпуску</h3>
            {blockers.length === 0 ? <p className="text-ui text-success-text">Все элементы реализованы и проверены.</p> : (
              <>
                <p className="text-ui text-text-muted">Не закрыто: {blockers.length}. Выпуск возможен только с причиной.</p>
                <p className="break-words font-mono text-meta text-text-muted">{blockers.map((b) => `${b.display_id} (${STAGE[b.stage as ReleaseStage]?.label ?? b.stage})`).join(', ')}</p>
              </>
            )}
          </div>
          <form className={box} onSubmit={(e) => { e.preventDefault(); void act('release', { tag: tag.trim(), reason: reason.trim() }); }} aria-label="Выпуск релиза">
            <h3 className="text-ui font-semibold">Выпустить релиз</h3>
            <p className="text-ui text-text-muted">Тег должен существовать в подключённом репозитории. Реализация и проверки оцениваются на коммите этого тега.</p>
            <div className="flex flex-wrap items-end gap-3">
              <TextField label="Тег" hint="например v0.2.0" value={tag} onChange={(e) => setTag(e.target.value)} className="w-56" />
              <TextField label={blockers.length ? 'Причина выпуска с незакрытым' : 'Комментарий'} hint={blockers.length ? 'обязательно' : 'необязательно'} value={reason} onChange={(e) => setReason(e.target.value)} className="w-96" />
            </div>
            <div><Button type="submit" variant="primary" disabled={busy || !tag.trim() || (blockers.length > 0 && !reason.trim())} loading={busy}>Выпустить</Button></div>
          </form>
        </>
      )}
      {r.status === 'released' && (
        <div className={box}>
          <h3 className="text-ui font-semibold">Выпущен</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ui">
            <dt className="text-text-muted">тег</dt><dd className="font-mono text-meta">{r.tag}</dd>
            <dt className="text-text-muted">коммит</dt><dd>{r.commit && <CopyId value={r.commit} className="font-mono text-meta">{r.commit}</CopyId>}</dd>
            <dt className="text-text-muted">кто и когда</dt><dd>{r.decided_by}, {r.released_at ? dateTime(r.released_at) : '—'}</dd>
            <dt className="text-text-muted">комментарий</dt><dd>{r.decision_reason ?? '—'}</dd>
            <dt className="text-text-muted">готовность на выпуске</dt><dd>{(r.readiness as ReleaseProgress | null)?.done ?? 0} из {(r.readiness as ReleaseProgress | null)?.total ?? 0}{(r.readiness?.blockers.length ?? 0) > 0 ? `, не закрыто: ${r.readiness?.blockers.map((b) => b.display_id).join(', ')}` : ''}</dd>
          </dl>
        </div>
      )}
      {r.status === 'cancelled' && <div className={box}><h3 className="text-ui font-semibold">Отменён</h3><p className="text-ui text-text-muted">{r.decided_by}: {r.decision_reason}</p></div>}
      {(r.status === 'planned' || r.status === 'frozen') && (
        <details className="rounded-card border border-border bg-surface p-4 text-ui">
          <summary className="cursor-pointer text-text-muted">{r.status === 'frozen' ? 'Снять фиксацию или отменить релиз' : 'Отменить релиз'}</summary>
          <div className="mt-3 flex flex-col gap-3">
            <TextField label="Причина" value={reason} onChange={(e) => setReason(e.target.value)} className="w-96" />
            <div className="flex gap-2">
              {r.status === 'frozen' && <Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => void act('unfreeze', { reason: reason.trim() })}>Снять фиксацию</Button>}
              <Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => void act('cancel', { reason: reason.trim() })}>Отменить релиз</Button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function ReportTab({ projectKey, r }: { projectKey: string; r: ReleaseDetail }) {
  const report = useAsync(`release-report:${projectKey}:${r.uid}:${r.status}:${r.progress.done}`, () => pthApi.releaseReport(projectKey, r.uid));
  const [view, setView] = useState<'rendered' | 'source'>('rendered');
  const download = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `release-${r.name}.md`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Section title="Отчёт по релизу" hint="Собирается из состава, продвижения, решения и проверок. У выпущенного релиза готовность взята из снимка на момент выпуска.">
      <Loaded state={report} retry={report.reload}>
        {(text) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs label="Вид отчёта" idPrefix="rel-report" selectedId={view} onChange={(id) => setView(id as typeof view)} items={[{ id: 'rendered', label: 'Документ' }, { id: 'source', label: 'Исходный Markdown' }]} />
              <Button size="sm" variant="secondary" onClick={() => download(text)}>Скачать .md</Button>
            </div>
            {view === 'rendered'
              ? <div className="rounded-card border border-border bg-surface p-5"><Markdown source={text} /></div>
              : <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-4 font-mono text-meta text-text">{text}</pre>}
          </>
        )}
      </Loaded>
    </Section>
  );
}

/** Сравнение состава двух релизов: что добавилось, убралось и сменило ревизию. */
function CompareReleases({ projectKey, releases }: { projectKey: string; releases: ReleaseSummary[] }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const cmp = useAsync(a && b && a !== b ? `release-cmp:${projectKey}:${a}:${b}` : null, () => pthApi.compareReleases(projectKey, a, b));
  const select = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex flex-col gap-1 text-meta text-text-muted">{label}
      <select value={value} onChange={(e) => set(e.target.value)} className="h-9 w-56 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
        <option value="">выберите релиз</option>
        {releases.map((r) => <option key={r.uid} value={r.uid}>{r.name}</option>)}
      </select>
    </label>
  );
  return (
    <Section title="Сравнение релизов" hint="Чем отличается состав: что добавлено во второй, что убрано и у чего сменилась ревизия.">
      <div className="flex flex-wrap items-end gap-3">{select(a, setA, 'Базовый релиз')}{select(b, setB, 'Сравниваемый релиз')}</div>
      {a && b && a === b && <p className="text-ui text-text-muted">Выберите два разных релиза.</p>}
      {cmp.data && <ComparisonView d={cmp.data} />}
    </Section>
  );
}

function ComparisonView({ d }: { d: ReleaseComparison }) {
  const block = (title: string, rows: { display_id: string; title: string; note?: string }[]) => rows.length > 0 && (
    <div className="flex flex-col gap-1">
      <h4 className="text-ui font-semibold">{title}: {rows.length}</h4>
      <ul className="text-ui">{rows.map((r) => <li key={r.display_id}><span className="font-mono text-meta">{r.display_id}</span> {r.title}{r.note && <span className="text-text-muted"> · {r.note}</span>}</li>)}</ul>
    </div>
  );
  const nothing = d.added.length + d.removed.length + d.changed.length === 0;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <p className="text-ui text-text-muted">{d.a.name} → {d.b.name}. Общих элементов: {d.same}.</p>
      {nothing && <p className="text-ui">Составы совпадают.</p>}
      {block('Добавлено', d.added)}
      {block('Убрано', d.removed)}
      {block('Сменилась ревизия', d.changed.map((c) => ({ ...c, note: `ревизия ${c.from} → ${c.to}` })))}
    </div>
  );
}

function WithoutStory({ stories, missing }: { stories: string[]; missing: string[] }) {
  const hint = stories.length === 0
    ? 'У требования нет user story: оно не связано refines ни с одной US'
    : `Взято без user story: ${missing.join(', ')} нет в релизе. Добавьте US или оставьте требование осознанно`;
  return (
    <Tooltip align="start" label={hint}>
      <span tabIndex={0} aria-label={`без US. ${hint}`} className="mt-0.5 inline-flex rounded-full border border-warning-text px-1.5 py-0.5 text-meta text-warning-text">без US{missing.length > 0 ? `: ${missing.join(', ')}` : ''}</span>
    </Tooltip>
  );
}
