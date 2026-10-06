import { useEffect, useState, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Pager, Tabs } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText, usePaged } from './common';
import { CopyId } from '@/shared/ui/CopyId';
import { ArtifactCard } from './ArtifactCard';
import { DiffView } from './DiffView';
import type { GitCommitDetail } from '@/entities/pth/types';

const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const FILE_STATUS: Record<string, string> = { A: 'добавлен', M: 'изменён', D: 'удалён', R: 'переименован', C: 'скопирован', T: 'тип изменён' };
const RESULT_RU: Record<string, string> = { pass: 'прошёл', fail: 'упал', blocked: 'не удалось запустить', inconclusive: 'не определён' };

/** Вкладка «Код»: коммиты читаются из Git сами; открытый коммит живёт в отдельной вкладке. */
export function CodeScreen({ projectKey }: { projectKey: string }) {
  const [tab, setTab] = useState<string>('list');
  const [open, setOpen] = useState<string[]>([]);
  const [syncVersion, setSyncVersion] = useState(0);
  // Новые коммиты регистрируются сами: при открытии вкладки догоняем всё, что хук ещё не успел. Нет прав записи или репозитория — молча пропускаем.
  useEffect(() => {
    pthApi.syncCommits(projectKey).then((r) => { if (r.registered > 0) setSyncVersion((v) => v + 1); }).catch(() => undefined);
  }, [projectKey]);
  const openCommit = (sha: string) => {
    setOpen((o) => (o.includes(sha) ? o : [...o, sha]));
    setTab(`c:${sha}`);
  };
  const closeCommit = (sha: string) => {
    setOpen((o) => o.filter((x) => x !== sha));
    setTab('list');
  };
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Разделы кода"
        idPrefix="code"
        selectedId={tab}
        onChange={setTab}
        items={[
          { id: 'list', label: 'Коммиты' },
          { id: 'repo', label: 'Репозиторий' },
          ...open.map((sha) => ({ id: `c:${sha}`, label: `Коммит ${sha.slice(0, 7)}` })),
        ]}
      />
      <div role="tabpanel" id={`code-panel-${tab}`} aria-labelledby={`code-tab-${tab}`}>
        {tab === 'list' && <CommitList key={syncVersion} projectKey={projectKey} onOpen={openCommit} />}
        {tab === 'repo' && <RepoPanel projectKey={projectKey} />}
        {tab.startsWith('c:') && <CommitTab key={tab} projectKey={projectKey} sha={tab.slice(2)} onClose={() => closeCommit(tab.slice(2))} />}
      </div>
    </div>
  );
}

function RepoPanel({ projectKey }: { projectKey: string }) {
  const repo = useAsync(`repo:${projectKey}`, () => pthApi.repo(projectKey));
  const info = useAsync(`git-info:${projectKey}`, () => pthApi.gitInfo(projectKey));
  const box = 'flex flex-col gap-2 rounded-card border border-border bg-surface p-4';
  return (
    <Section title="Репозиторий" hint="Только чтение. Коммиты читаются из подключённого репозитория, регистрировать их не нужно. Коммит, которого нет в репозитории, не подтверждается.">
      <Loaded state={repo} retry={repo.reload}>
        {(r) => !r.connected ? (
          <p className="text-ui text-text">Не подключён. Без репозитория нет списка коммитов, а результаты CI остаются «ожидают проверки» и не засчитываются. Подключает администратор: PUT /projects/{'{key}'}/repo.</p>
        ) : !r.available ? (
          <p className="text-ui text-danger-text">Репозиторий <span className="font-mono text-meta">{r.path}</span> недоступен: {r.note}</p>
        ) : (
          <Loaded state={info} retry={info.reload}>
            {(g) => (
              <div className="flex flex-col gap-4">
                <div className={box}>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ui">
                    <dt className="text-text-muted">путь</dt><dd className="font-mono text-meta">{g.path}</dd>
                    <dt className="text-text-muted">ветка</dt><dd>{g.branch ?? 'отсоединённый HEAD'}</dd>
                    <dt className="text-text-muted">HEAD</dt>
                    <dd>{g.head ? <><CopyId value={g.head.sha} className="font-mono text-meta">{g.head.sha.slice(0, 10)}</CopyId> {g.head.title} <span className="text-text-muted">· {g.head.author}, {dateTime(g.head.date)}</span></> : '—'}</dd>
                    <dt className="text-text-muted">коммитов</dt><dd>{g.commits}{g.first_commit_at ? <span className="text-text-muted"> · с {new Date(g.first_commit_at).toLocaleDateString('ru-RU')}</span> : null}</dd>
                    <dt className="text-text-muted">файлов</dt><dd>{g.files}</dd>
                    <dt className="text-text-muted">удалённые адреса</dt><dd className="font-mono text-meta">{g.remotes.length ? g.remotes.map((x) => `${x.name}: ${x.url}`).join('; ') : 'нет'}</dd>
                    <dt className="text-text-muted">ветки</dt><dd className="font-mono text-meta">{g.branches.join(', ') || '—'}</dd>
                    <dt className="text-text-muted">теги</dt><dd className="font-mono text-meta">{g.tags.join(', ') || 'нет'}</dd>
                  </dl>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={box}>
                    <h3 className="text-ui font-semibold">Авторы</h3>
                    <ul className="text-ui">{g.authors.map((a) => <li key={a.name} className="flex justify-between gap-2"><span>{a.name}</span><span className="text-text-muted">{a.commits}</span></li>)}</ul>
                  </div>
                  <div className={box}>
                    <h3 className="text-ui font-semibold">Папки верхнего уровня</h3>
                    <ul className="text-ui">{g.top_dirs.map((d) => <li key={d.path} className="flex justify-between gap-2"><span className="font-mono text-meta">{d.path}</span><span className="text-text-muted">{d.files}</span></li>)}</ul>
                  </div>
                  <div className={box}>
                    <h3 className="text-ui font-semibold">Типы файлов</h3>
                    <ul className="text-ui">{g.extensions.map((x) => <li key={x.ext} className="flex justify-between gap-2"><span className="font-mono text-meta">{x.ext}</span><span className="text-text-muted">{x.files}</span></li>)}</ul>
                  </div>
                </div>
              </div>
            )}
          </Loaded>
        )}
      </Loaded>
    </Section>
  );
}

function CommitList({ projectKey, onOpen }: { projectKey: string; onOpen: (sha: string) => void }) {
  const [page, setPage] = useState(0);
  const PAGE = 20;
  const commits = useAsync(`git-commits:${projectKey}:${page}`, () => pthApi.gitCommitsPage(projectKey, page * PAGE, PAGE));
  return (
    <Section title="Коммиты" hint="Список читается из Git при каждом открытии, новые коммиты появляются сами. Связи с требованиями и результаты проверок берутся из PTH.">
      <Loaded state={commits} retry={commits.reload} empty={{ title: 'Коммитов нет', isEmpty: (d) => d.items.length === 0 }}>
        {({ items: rows, total }) => (
          <DataTable caption="Коммиты" columns="7rem minmax(0,1.6fr) 8rem 10rem minmax(0,1fr) minmax(0,1fr)"
            headers={['SHA', 'Сообщение', 'Автор', 'Когда', 'Требования', 'Проверки']}
            onRowSelect={(i) => onOpen(rows[i].sha)}
            footer={<Pager page={page} pageSize={PAGE} total={total} onPage={setPage} label="Страницы коммитов" />}
            rows={rows.map((c) => [
              <CopyId key="s" value={c.sha} className="font-mono text-meta">{c.sha.slice(0, 10)}</CopyId>,
              c.title,
              c.author,
              dateTime(c.date),
              <span key="r" className="flex flex-col font-mono text-meta">
                {c.implements.length > 0 && <span>реализует: {c.implements.join(', ')}</span>}
                {c.mentions.length > 0 && <span className="text-text-muted">в сообщении: {c.mentions.join(', ')}</span>}
                {c.implements.length === 0 && c.mentions.length === 0 && '—'}
              </span>,
              c.checks ? (
                <span key="k" className="flex flex-wrap gap-x-3">
                  {c.checks.passed > 0 && <StatusText label={`прошло ${c.checks.passed}`} tone="ok" />}
                  {c.checks.failed > 0 && <StatusText label={`упало ${c.checks.failed}`} tone="bad" />}
                  {c.checks.total - c.checks.passed - c.checks.failed > 0 && <StatusText label={`прочее ${c.checks.total - c.checks.passed - c.checks.failed}`} tone="warn" />}
                </span>
              ) : <span key="k" className="text-meta text-text-muted">не запускались</span>,
            ])} />
        )}
      </Loaded>
    </Section>
  );
}

/** Вкладка одного коммита: Git-данные, файлы, требования, проверки. */
function CommitTab({ projectKey, sha, onClose }: { projectKey: string; sha: string; onClose: () => void }) {
  const [version, setVersion] = useState(0);
  const data = useAsync(`git-commit:${projectKey}:${sha}:${version}`, () => pthApi.gitCommit(projectKey, sha));
  const [req, setReq] = useState<string | null>(null);
  if (req) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setReq(null)}>Назад к коммиту</Button></div>
        <ArtifactCard key={req} projectKey={projectKey} displayId={req} onOpen={setReq} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={onClose}>Закрыть вкладку</Button></div>
      <Loaded state={data} retry={data.reload}>
        {(c) => <CommitBody projectKey={projectKey} c={c} onOpenReq={setReq} onLinked={() => setVersion((v) => v + 1)} />}
      </Loaded>
    </div>
  );
}

function CommitBody({ projectKey, c, onOpenReq, onLinked }: { projectKey: string; c: GitCommitDetail; onOpenReq: (id: string) => void; onLinked: () => void }) {
  const box = 'flex flex-col gap-2 rounded-card border border-border bg-surface p-4';
  const runsPaged = usePaged(c.runs, 20, 'Страницы проверок');
  const filesPaged = usePaged(c.files, 20, 'Страницы файлов');
  const added = c.files.reduce((n, f) => n + (f.added ?? 0), 0);
  const deleted = c.files.reduce((n, f) => n + (f.deleted ?? 0), 0);
  return (
    <>
      <div className={box}>
        <h3 className="text-section font-semibold text-text">{c.subject}</h3>
        {c.body && <p className="whitespace-pre-wrap text-ui text-text-muted">{c.body}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
          <dt className="text-text-muted">коммит</dt><dd><CopyId value={c.sha} className="font-mono">{c.sha}</CopyId>{c.is_head ? ' (HEAD)' : ''}</dd>
          <dt className="text-text-muted">автор</dt><dd>{c.author} <span className="text-text-muted">{c.email}</span> · {dateTime(c.authored_at)}</dd>
          {c.committer !== c.author && <><dt className="text-text-muted">зафиксировал</dt><dd>{c.committer} · {dateTime(c.committed_at)}</dd></>}
          <dt className="text-text-muted">родители</dt><dd className="font-mono">{c.parents.map((p) => p.slice(0, 10)).join(', ') || 'нет (первый коммит)'}</dd>
          {c.tags.length > 0 && <><dt className="text-text-muted">теги</dt><dd>{c.tags.join(', ')}</dd></>}
          <dt className="text-text-muted">в PTH</dt><dd>{c.registered ?? 'ещё не зарегистрирован: регистрируется при запуске хука или открытии вкладки «Код»'}</dd>
        </dl>
      </div>

      <div className={box}>
        <h3 className="text-ui font-semibold">Требования</h3>
        <ReqTabs implementsRows={c.implements} mentions={c.mentions} onOpen={onOpenReq} onLink={async (ids) => {
          if (c.registered) await pthApi.linkCommit(projectKey, c.sha, ids);
          else await pthApi.registerCommit(projectKey, { sha: c.sha, title: c.subject, implements: ids });
          onLinked();
        }} />
      </div>

      <div className={box}>
        <h3 className="text-ui font-semibold">Проверки на этом коммите</h3>
        {c.runs.length === 0 ? <p className="text-ui text-text-muted">Тесты на этом коммите не запускались. Результаты появятся после запуска хука.</p> : (
          <DataTable caption="Проверки коммита" columns="8rem minmax(0,1fr) 7rem 10rem" headers={['Тест', 'Название', 'Результат', 'Когда']}
            footer={runsPaged.pager}
            rows={runsPaged.rows.map((r) => [
              <span key="t" className="font-mono text-meta">{r.test ?? '—'}</span>, r.title ?? '—',
              <StatusText key="r" label={RESULT_RU[r.result] ?? r.result} tone={r.result === 'pass' ? 'ok' : r.result === 'fail' ? 'bad' : 'warn'} />,
              dateTime(r.ran_at),
            ])} />
        )}
      </div>

      <div className={box}>
        <h3 className="text-ui font-semibold">Изменённые файлы: {c.files.length} <span className="font-normal text-text-muted">(+{added} −{deleted})</span></h3>
        {c.files.length === 0 ? <p className="text-ui text-text-muted">Коммит не меняет файлы (пустой или слияние).</p> : (
          <>
            <ul className="flex flex-col gap-2" aria-label="Файлы коммита">
              {filesPaged.rows.map((f) => <FileEntry key={f.path} projectKey={projectKey} sha={c.sha} f={f} />)}
            </ul>
            {filesPaged.pager}
          </>
        )}
      </div>

      <ManualLink projectKey={projectKey} c={c} onLinked={onLinked} />
    </>
  );
}

/** «Реализует» и «Упомянуты» — разные вещи: заявленная связь и подсказка из сообщения, поэтому отдельные вкладки. */
function ReqTabs({ implementsRows, mentions, onOpen, onLink }: { implementsRows: { id: string; title: string }[]; mentions: { id: string; title: string }[]; onOpen: (id: string) => void; onLink: (ids: string[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = async (ids: string[]) => {
    setBusy(true);
    setError(null);
    try { await onLink(ids); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось связать'); } finally { setBusy(false); }
  };
  const [tab, setTab] = useState<'implements' | 'mentions'>(implementsRows.length === 0 && mentions.length > 0 ? 'mentions' : 'implements');
  return (
    <div className="flex flex-col gap-3">
      <Tabs label="Требования коммита" idPrefix="commit-reqs" selectedId={tab} onChange={(id) => setTab(id as typeof tab)}
        items={[{ id: 'implements', label: `Реализует (${implementsRows.length})` }, { id: 'mentions', label: `Упомянуты (${mentions.length})` }]} />
      <div role="tabpanel" id={`commit-reqs-panel-${tab}`} aria-labelledby={`commit-reqs-tab-${tab}`} className="flex flex-col gap-2">
        {tab === 'implements' ? (
          <>
            <p className="text-meta text-text-muted">Связь implements: автор заявил, что коммит реализует эти требования. Это не доказательство.</p>
            {implementsRows.length === 0 ? <p className="text-ui text-text-muted">Связей нет. Можно добавить вручную ниже.</p> : <ReqTable rows={implementsRows} onOpen={onOpen} />}
          </>
        ) : (
          <>
            <p className="text-meta text-text-muted">ID требований из сообщения коммита. Связи нет, это только подсказка. «Связать» превращает упоминание в связь implements, то есть заявляет, что коммит реализует требование.</p>
            {error && <InlineAlert tone="danger" message={error} />}
            {mentions.length === 0 ? <p className="text-ui text-text-muted">В сообщении коммита нет ID требований.</p> : (
              <>
                <div><Button size="sm" variant="secondary" disabled={busy} onClick={() => void link(mentions.map((m) => m.id))}>Связать все ({mentions.length})</Button></div>
                <ReqTable rows={mentions} onOpen={onOpen} action={(r) => <Button size="sm" variant="secondary" disabled={busy} onClick={() => void link([r.id])}>Связать</Button>} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReqTable({ rows, onOpen, action }: { rows: { id: string; title: string }[]; onOpen: (id: string) => void; action?: (r: { id: string; title: string }) => React.ReactNode }) {
  const paged = usePaged(rows, 20, 'Страницы требований');
  return (
    <DataTable caption="Требования коммита" columns={action ? '9rem minmax(0,1fr) 7rem' : '9rem minmax(0,1fr)'} headers={action ? ['Требование', 'Название', ''] : ['Требование', 'Название']}
      footer={paged.pager}
      onRowSelect={(i) => onOpen(paged.rows[i].id)}
      rows={paged.rows.map((r) => [<CopyId key="i" value={r.id} className="font-mono text-meta"><button type="button" className="text-accent-text underline underline-offset-2" onClick={() => onOpen(r.id)}>{r.id}</button></CopyId>, r.title, ...(action ? [<span key="a">{action(r)}</span>] : [])])} />
  );
}

/** Крайнее средство: явно заявить, что коммит реализует требования. Свёрнуто, потому что обычно связь появляется иначе. */
function ManualLink({ projectKey, c, onLinked }: { projectKey: string; c: GitCommitDetail; onLinked: () => void }) {
  const [ids, setIds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const list = ids.split(/[\s,;]+/).map((s) => s.toUpperCase()).filter(Boolean);
      if (c.registered) await pthApi.linkCommit(projectKey, c.sha, list);
      else await pthApi.registerCommit(projectKey, { sha: c.sha, title: c.subject, implements: list });
      setIds('');
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связать');
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-card border border-border bg-surface p-4 text-ui">
      <summary className="cursor-pointer text-text-muted">Заявить реализацию требований вручную (крайний случай)</summary>
      <p className="mt-2 text-meta text-text-muted">Коммит уже зарегистрирован в PTH автоматически, здесь добавляются только связи «коммит реализует требование». Это утверждение автора, не доказательство. Используйте, если связь иначе не появится.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2" aria-label="Ручная связь коммита">
        <label className="flex flex-col gap-1 text-meta text-text-muted">
          Реализуемые требования (через пробел или запятую)
          <input value={ids} onChange={(e) => setIds(e.target.value)} className="h-9 w-96 rounded-control border border-control-border bg-surface px-2 text-ui text-text" />
        </label>
        <Button type="submit" variant="secondary" disabled={!ids.trim() || busy} loading={busy}>Связать</Button>
      </form>
      {error && <InlineAlert tone="danger" message={error} />}
    </details>
  );
}

/** Файл коммита: строка со статусом и числами, по клику раскрывается diff. */
function FileEntry({ projectKey, sha, f }: { projectKey: string; sha: string; f: GitCommitDetail['files'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-control border border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted/60">
        <span aria-hidden="true" className="text-text-muted">{open ? '▾' : '▸'}</span>
        <span className="font-mono text-meta text-text">{f.path}</span>
        <span className="text-meta text-text-muted">{FILE_STATUS[f.status] ?? f.status}</span>
        <span className="ml-auto flex gap-2 font-mono text-meta">
          <span className="text-success-text">{f.added === null ? 'бин.' : `+${f.added}`}</span>
          <span className="text-danger-text">{f.deleted === null ? '' : `−${f.deleted}`}</span>
        </span>
      </button>
      {open && <div className="border-t border-border p-3"><DiffView projectKey={projectKey} sha={sha} path={f.path} /></div>}
    </li>
  );
}
