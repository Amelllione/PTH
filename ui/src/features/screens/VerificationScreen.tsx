import { useState, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Markdown, Pager, Tabs, TextField } from '@/shared/ui';
import type { TestRow } from '@/entities/pth/types';
import { DataTable, Loaded, Section, StatusText, usePaged } from './common';
import { CopyId } from '@/shared/ui/CopyId';
import { ArtifactCard } from './ArtifactCard';

const TEST_STATE: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  passed_current: { label: 'прошёл на HEAD', tone: 'ok' },
  passed: { label: 'прошёл (HEAD неизвестен)', tone: 'ok' },
  passed_old_commit: { label: 'прошёл на старом коммите', tone: 'warn' },
  failed: { label: 'упал', tone: 'bad' },
  inconclusive: { label: 'не определён', tone: 'warn' },
  pending_verification: { label: 'ожидает проверки', tone: 'warn' },
  not_run: { label: 'не запускался', tone: 'neutral' },
};

const COMPLIANCE_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  verified: 'ok', partial: 'warn', failed: 'bad', stale: 'warn', not_verified: 'warn', no_test: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  verified: 'проверено', partial: 'покрыто частично', failed: 'упало', stale: 'устарело', not_verified: 'не проверено', no_test: 'нет теста', excluded: 'исключено',
};

type VTab = 'tests' | 'requirements' | 'runs' | 'psi';

export function VerificationScreen({ projectKey }: { projectKey: string }) {
  const [tab, setTab] = useState<VTab>('tests');
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Разделы проверки"
        idPrefix="verify"
        selectedId={tab}
        onChange={(id) => setTab(id as VTab)}
        items={[
          { id: 'tests', label: 'Тесты' },
          { id: 'requirements', label: 'Соответствие требований' },
          { id: 'runs', label: 'Запуски' },
          { id: 'psi', label: 'Черновик ПСИ' },
        ]}
      />
      <div role="tabpanel" id={`verify-panel-${tab}`} aria-labelledby={`verify-tab-${tab}`}>
        {tab === 'tests' && (
          <Section title="Тесты" hint="Что входит в тест, какие требования и какой код он проверяет. Результаты приходят из хука после каждого коммита.">
            <TestsPanel projectKey={projectKey} />
          </Section>
        )}
        {tab === 'requirements' && <RequirementsPanel projectKey={projectKey} />}
        {tab === 'runs' && <RunsPanel projectKey={projectKey} />}
        {tab === 'psi' && <PsiPanel projectKey={projectKey} />}
      </div>
    </div>
  );
}

function PsiPanel({ projectKey }: { projectKey: string }) {
  const psi = useAsync(`psi:${projectKey}`, () => pthApi.psi(projectKey));
  const [view, setView] = useState<'rendered' | 'source'>('rendered');
  return (
    <Section title="Черновик ПСИ" hint="Сгенерировано из требований и свидетельств. Не утверждённый документ.">
      <Tabs
        label="Вид черновика"
        idPrefix="psi-view"
        selectedId={view}
        onChange={(id) => setView(id as 'rendered' | 'source')}
        items={[{ id: 'rendered', label: 'Документ' }, { id: 'source', label: 'Исходный Markdown' }]}
      />
      <Loaded state={psi} retry={psi.reload}>
        {(text) => view === 'rendered' ? (
          <div className="rounded-card border border-border bg-surface p-5"><Markdown source={text} /></div>
        ) : (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-4 font-mono text-meta text-text">{text}</pre>
        )}
      </Loaded>
    </Section>
  );
}

function RequirementsPanel({ projectKey }: { projectKey: string }) {
  const compliance = useAsync(`compliance:${projectKey}`, () => pthApi.compliance(projectKey));
  const [compPage, setCompPage] = useState(0);
  const [chip, setChip] = useState<string>('all');
  const COMP = 20;
  return (
    <Section title="Соответствие требований" hint="Требование проверено, только если все его тесты прошли и свидетельство новее последней правки требования.">
      <Loaded state={compliance} retry={compliance.reload}>
        {(c) => {
          const visible = c.items.filter((i) => i.status !== 'excluded' && (chip === 'all' || i.status === chip));
          const pageItems = visible.slice(compPage * COMP, (compPage + 1) * COMP);
          const select = (next: string) => { setChip(next); setCompPage(0); };
          return (
            <>
              <div role="group" aria-label="Фильтр по статусу" className="flex flex-wrap gap-2">
                <Chip label="все" count={c.items.filter((i) => i.status !== 'excluded').length} active={chip === 'all'} onClick={() => select('all')} />
                {Object.entries(c.counts).filter(([s]) => s !== 'excluded').map(([s, n]) => (
                  <Chip key={s} label={STATUS_LABEL[s] ?? s} count={n} active={chip === s} onClick={() => select(s)} />
                ))}
              </div>
              <DataTable
                caption="Соответствие требований"
                columns="9rem 9rem minmax(0,1fr)"
                footer={<Pager page={compPage} pageSize={COMP} total={visible.length} onPage={setCompPage} label="Страницы соответствия" />}
                headers={['Требование', 'Статус', 'Тесты']}
                rows={pageItems.map((i) => [
                  <CopyId key="i" value={i.display_id} className="font-mono text-meta">{i.display_id}</CopyId>,
                  <StatusText key="st" label={STATUS_LABEL[i.status] ?? i.status} tone={COMPLIANCE_TONE[i.status] ?? 'neutral'} />,
                  i.tests.map((t) => `${t.display_id} (${STATUS_LABEL[t.status] ?? t.status})`).join(', ') || '—',
                ])}
              />
            </>
          );
        }}
      </Loaded>
    </Section>
  );
}

const KIND_LABEL: Record<string, string> = { unit: 'функциональные тесты', load: 'нагрузочные испытания', static: 'статический анализ', security: 'поиск уязвимостей', other: 'прочая проверка CI' };
const TRUST_LABEL: Record<string, string> = { trusted_ci: 'хук CI, подтверждён', human_recorded: 'внесён вручную' };

/** Журнал запусков. Основной путь — хук после коммита; ручная запись спрятана и нужна как исключение. */
function RunsPanel({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const [evPage, setEvPage] = useState(0);
  const EV = 20;
  const sets = useAsync(`run-sets:${projectKey}:${version}:${evPage}`, () => pthApi.runSetsPage(projectKey, evPage * EV, EV));
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [test, setTest] = useState('');
  const [result, setResult] = useState<'pass' | 'fail' | 'blocked'>('pass');
  const [commit, setCommit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const record = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pthApi.recordEvidence(projectKey, { test: test.trim().toUpperCase(), result, commit_sha: commit.trim() || undefined });
      setTest('');
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось записать');
    } finally {
      setBusy(false);
    }
  };

  if (openSha) {
    return (
      <CommitRunsCard projectKey={projectKey} sha={openSha} onBack={() => setOpenSha(null)} backLabel="Назад к запускам" />
    );
  }
  return (
    <Section title="Запуски" hint="Набор — все проверки, выполненные на одном коммите; по каждому тесту показан последний запуск. Результаты приходят из post-commit хука (sdk/pth_ci.py) с проверкой коммита в Git. Нажмите на набор, чтобы увидеть каждую проверку.">
      <Loaded state={sets} retry={sets.reload} empty={{ title: 'Запусков нет', description: 'Подключите хук: scripts/install_git_hook.sh. После коммита результаты появятся здесь.', isEmpty: (d) => d.items.length === 0 }}>
        {({ items: rows, total }) => (
          <DataTable caption="Наборы запусков" columns="11rem 9rem minmax(0,1.2fr) minmax(0,1fr) 5rem minmax(0,1fr)" headers={['Когда', 'Коммит', 'Набор проверок', 'Итог', 'Файлов', 'Источник']}
            onRowSelect={(i) => { if (rows[i].commit) setOpenSha(rows[i].commit); }}
            footer={<Pager page={evPage} pageSize={EV} total={total} onPage={setEvPage} label="Страницы наборов" />}
            rows={rows.map((s) => [
              dateTimeRu(s.ran_at),
              <span key="c" className="font-mono text-meta">{s.commit ? s.commit.slice(0, 10) : 'без коммита'}</span>,
              <span key="k" className="flex flex-col"><span>{s.total} {plural(s.total, 'проверка', 'проверки', 'проверок')}</span>
                {s.kinds.map((k) => <span key={k} className="text-meta text-text-muted">{KIND_LABEL[k] ?? k}: {s.results.filter((r) => r.kind === k).length}</span>)}</span>,
              <span key="r" className="flex flex-wrap gap-x-3 gap-y-0.5">
                {s.passed > 0 && <StatusText label={`прошло ${s.passed}`} tone="ok" />}
                {s.failed > 0 && <StatusText label={`упало ${s.failed}`} tone="bad" />}
                {s.other > 0 && <StatusText label={`прочее ${s.other}`} tone="warn" />}
              </span>,
              s.attachments > 0 ? String(s.attachments) : '—',
              <span key="s" className="text-meta">{s.sources.map((x) => TRUST_LABEL[x] ?? x).join(', ')}</span>,
            ])} />
        )}
      </Loaded>
      <details className="rounded-card border border-border bg-surface p-4 text-ui">
        <summary className="cursor-pointer text-text-muted">Внести результат вручную (исключение)</summary>
        <p className="mt-2 text-meta text-text-muted">Только если хук недоступен и тест реально запускали. «Не удалось запустить» — когда тест не стартовал (нет окружения, сломана сборка), это не то же самое, что «упал». Такая запись помечается как внесённая вручную и неизменяема.</p>
        <form onSubmit={record} className="mt-3 flex flex-wrap items-end gap-2" aria-label="Ручная запись результата">
          <TextField label="Тест" hint="например PTH-TEST-001" value={test} onChange={(e) => setTest(e.target.value)} className="w-56" />
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Результат
            <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="pass">прошёл</option><option value="fail">упал</option><option value="blocked">не удалось запустить</option>
            </select>
          </label>
          <TextField label="Коммит" hint="необязательно" value={commit} onChange={(e) => setCommit(e.target.value)} className="w-44" />
          <Button type="submit" variant="secondary" disabled={!test.trim() || busy} loading={busy}>Записать</Button>
        </form>
        {error && <InlineAlert tone="danger" message={error} />}
      </details>
    </Section>
  );
}

/** Чип-фильтр: нажат — показывает только этот статус. */
function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-ui ${
        active ? 'border-focus bg-accent-soft text-accent-text' : 'border-border bg-surface text-text hover:bg-surface-muted'
      }`}
    >
      {label}
      <span className="font-semibold tabular-nums">{count}</span>
    </button>
  );
}

function TestsPanel({ projectKey }: { projectKey: string }) {
  const tests = useAsync(`tests-status:${projectKey}`, () => pthApi.testsStatus(projectKey));
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (openSha) {
    return (
      <CommitRunsCard projectKey={projectKey} sha={openSha} onBack={() => setOpenSha(null)} backLabel="Назад к тесту" />
    );
  }
  if (openReq) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setOpenReq(null)}>Назад к тесту</Button></div>
        <ArtifactCard key={openReq} projectKey={projectKey} displayId={openReq} onOpen={setOpenReq} />
      </div>
    );
  }
  if (adding) {
    return <AddTestForm projectKey={projectKey} onClose={() => { setAdding(false); tests.reload(); }} />;
  }
  return (
    <Loaded state={tests} retry={tests.reload} empty={{ title: 'Тестов нет', description: 'Заведите TEST-элемент и свяжите его с требованием связью verifies.', isEmpty: (d) => d.tests.length === 0 }}>
      {(d) => {
        const open = d.tests.find((t) => t.test === openId);
        if (open) {
          return (
            <div className="flex flex-col gap-4">
              <div><Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>Назад к тестам</Button></div>
              <TestDetail t={open} head={d.head} onOpenCommit={setOpenSha} onOpenRequirement={setOpenReq} />
            </div>
          );
        }
        return (
          <TestsList d={d} onAdd={() => setAdding(true)} onOpen={setOpenId} />
        );
      }}
    </Loaded>
  );
}

function TestsList({ d, onAdd, onOpen }: { d: { head: string | null; counts: Record<string, number>; tests: TestRow[]; requirements_without_test: string[] }; onAdd: () => void; onOpen: (id: string) => void }) {
  const paged = usePaged(d.tests, 20, 'Страницы тестов');
  return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={onAdd}>Добавить тест</Button>
            </div>
            <p className="text-ui text-text-muted">
              HEAD: <span className="font-mono">{d.head ? d.head.slice(0, 10) : '—'}</span>
              {Object.entries(d.counts).map(([s, n]) => ` · ${TEST_STATE[s]?.label ?? s}: ${n}`).join('')}
            </p>
            <DataTable
              caption="Состояние тестов"
              columns="8rem minmax(0,1.2fr) minmax(0,1fr) 12rem 8rem"
              headers={['Тест', 'Что проверяет', 'Требования', 'Состояние', 'Коммит']}
              onRowSelect={(i) => onOpen(paged.rows[i].test)}
              footer={paged.pager}
              rows={paged.rows.map((t) => [
                <CopyId key="t" value={t.test} className="font-mono text-meta">{t.test}</CopyId>,
                t.title,
                <span key="r" className="font-mono text-meta">{t.requirements.join(', ') || '—'}</span>,
                <span key="s" className="flex flex-col gap-0.5">
                  <StatusText label={TEST_STATE[t.state]?.label ?? t.state} tone={TEST_STATE[t.state]?.tone ?? 'neutral'} />
                  {t.coverage === 'partial' && <span className="text-meta text-warning-text">неполный набор</span>}
                </span>,
                <span key="c" className="font-mono text-meta" title={t.commit ?? ''}>{t.commit ? t.commit.slice(0, 10) : '—'}</span>,
              ])}
            />
            {d.requirements_without_test.length > 0 && (
              <details className="text-ui">
                <summary className="cursor-pointer font-semibold text-text">Требования без теста: {d.requirements_without_test.length}</summary>
                <p className="mt-2 break-words font-mono text-meta text-text-muted">{d.requirements_without_test.join(', ')}</p>
              </details>
            )}
          </>
  );
}

/** Карточка теста: что запускается, какие требования и какой код проверяет, история запусков. */
function TestDetail({ t, head, onOpenCommit, onOpenRequirement }: { t: TestRow; head: string | null; onOpenCommit: (sha: string) => void; onOpenRequirement: (id: string) => void }) {
  const box = 'flex flex-col gap-2 rounded-card border border-border bg-surface p-4';
  const reqPaged = usePaged(t.requirements, 20, 'Страницы требований');
  return (
    <div className="flex flex-col gap-4">
      <div className={box}>
        <h3 className="text-section font-semibold text-text">{t.title}</h3>
        <p className="font-mono text-meta text-text-muted">{t.test}</p>
        <StatusText label={TEST_STATE[t.state]?.label ?? t.state} tone={TEST_STATE[t.state]?.tone ?? 'neutral'} />
        {t.coverage === 'partial' && <p className="text-meta text-warning-text">Неполный набор: {t.coverage_gaps}</p>}
      </div>
      <div className={box}>
        <h3 className="text-ui font-semibold">Что входит в тест</h3>
        {t.command ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
            <dt className="text-text-muted">вид</dt><dd>{KIND_LABEL[t.kind] ?? t.kind}</dd>
            <dt className="text-text-muted">команда</dt><dd className="font-mono break-words">{t.command}</dd>
            <dt className="text-text-muted">файлы</dt><dd className="font-mono">{t.files.join(', ') || '—'}</dd>
            <dt className="text-text-muted">отбор (-k)</dt><dd className="font-mono break-words">{t.selector ?? 'все тесты файла'}</dd>
          </dl>
        ) : <p className="text-ui text-text-muted">Команда запуска не задана: {t.text || 'описание пустое'}.</p>}
      </div>
      <div className={box}>
        <h3 className="text-ui font-semibold">Где добавлен и менялся тест</h3>
        <p className="text-meta text-text-muted">История файлов теста в Git{t.selector ? '. Тест выбирается по -k, поэтому показаны все правки файла, а не только этого теста' : ''}.</p>
        {!t.test_history ? <p className="text-ui text-text-muted">Нет данных: репозиторий проекта не подключён или в команде нет файлов теста.</p> : (
          <>
            <GitTimeline history={t.test_history} onOpen={onOpenCommit} />
          </>
        )}
      </div>
      <div className={box}>
        <h3 className="text-ui font-semibold">Какие требования проверяет</h3>
        {t.requirements.length === 0 ? <p className="text-ui text-text-muted">Не связан ни с одним требованием (verifies).</p> : (
          <DataTable caption="Проверяемые требования" columns="9rem minmax(0,1fr)" headers={['Требование', 'Название']}
            footer={reqPaged.pager}
            onRowSelect={(i) => onOpenRequirement(reqPaged.rows[i])}
            rows={reqPaged.rows.map((r) => [
              <CopyId key="i" value={r} className="font-mono text-meta"><button type="button" className="text-accent-text underline underline-offset-2" onClick={() => onOpenRequirement(r)}>{r}</button></CopyId>,
              t.requirement_titles[r] ?? '—',
            ])} />
        )}
      </div>
      <div className={box}>
        <h3 className="text-ui font-semibold">Коммиты проверяемой функциональности</h3>
        <p className="text-meta text-text-muted">Коммиты, которые заявили реализацию требований, проверяемых тестом (связь implements). Это код функции, а не коммиты с самим тестом. Что тест реально запускался на каком коммите, видно ниже в запусках.</p>
        {t.code_commits.length === 0 ? <p className="text-ui text-text-muted">Коммитов нет: проверяемые требования не связаны с кодом.</p> : (
          <ul className="flex flex-col gap-1 text-ui">
            {t.code_commits.map((c) => (
              <li key={c.display_id} className="flex flex-wrap items-baseline gap-2">
                {c.sha ? <button type="button" className="font-mono text-meta text-accent-text underline underline-offset-2" onClick={() => onOpenCommit(c.sha!)}>{c.sha.slice(0, 10)}</button> : <span className="font-mono text-meta">{c.display_id}</span>}
                <span className="text-text-muted">{c.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={box}>
        <h3 className="text-ui font-semibold">Запуски по коммитам</h3>
        <p className="text-meta text-text-muted">Коммиты, на которых тест запускался хуком или был принят вручную. Нажмите на коммит, чтобы увидеть все тесты на нём.</p>
        {t.history.length === 0 ? <p className="text-ui text-text-muted">Тест ещё не запускался. Результат появится после следующего коммита с хуком.</p> : (
          <DataTable caption="История запусков теста" columns="11rem 7rem 9rem minmax(0,1fr)" headers={['Когда', 'Результат', 'Коммит', 'Источник']}
            rows={t.history.map((h) => [
              new Date(h.ran_at).toLocaleString('ru-RU'),
              h.result,
              h.commit ? <button key="c" type="button" className="font-mono text-meta text-accent-text underline underline-offset-2" onClick={() => onOpenCommit(h.commit!)}>{h.commit.slice(0, 10)}{head && h.commit === head ? ' (HEAD)' : ''}</button> : <span key="c">—</span>,
              <span key="s" className="text-meta">{TRUST_LABEL[h.trust] ?? h.trust}{h.issuer ? ` · ${h.issuer}` : ''}</span>,
            ])} />
        )}
      </div>
    </div>
  );
}

/** Карточка коммита: все запуски тестов на нём и реализуемые требования. Работает и для незарегистрированных коммитов. */
function CommitRunsCard({ projectKey, sha, onBack, backLabel }: { projectKey: string; sha: string; onBack: () => void; backLabel: string }) {
  const data = useAsync(`commit-runs:${projectKey}:${sha}`, () => pthApi.commitRuns(projectKey, sha));
  const [file, setFile] = useState<string | null>(null);
  if (file) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setFile(null)}>Назад к набору</Button></div>
        <AttachmentView projectKey={projectKey} uid={file} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
    <div><Button variant="secondary" size="sm" onClick={onBack}>{backLabel}</Button></div>
    <Loaded state={data} retry={data.reload}>
      {(c) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4">
            <h3 className="text-section font-semibold text-text">Коммит <CopyId value={c.sha ?? sha} className="font-mono">{(c.sha ?? sha).slice(0, 10)}</CopyId></h3>
            <p className="text-ui text-text-muted">{c.title ?? 'Коммит не зарегистрирован в PTH как COMMIT: известны только запуски тестов.'}</p>
            {c.implements.length > 0 && <p className="text-ui">Реализует: <span className="font-mono text-meta">{c.implements.join(', ')}</span></p>}
          </div>
          <DataTable caption="Запуски на коммите" columns="8rem minmax(0,1fr) 6rem 10rem minmax(0,1fr) minmax(0,1fr)" headers={['Тест', 'Название', 'Результат', 'Когда', 'Источник', 'Файлы']}
            rows={c.runs.map((r) => [
              <span key="t" className="font-mono text-meta">{r.test ?? '—'}</span>, r.title ?? '—', r.result,
              dateTimeRu(r.ran_at),
              <span key="s" className="text-meta">{TRUST_LABEL[r.trust] ?? r.trust}{r.issuer ? ` · ${r.issuer}` : ''}</span>,
              <span key="f" className="flex flex-col items-start gap-0.5">
                {r.files.length === 0 ? '—' : r.files.map((f) => (
                  <button key={f.uid} type="button" className="text-meta text-accent-text underline underline-offset-2" onClick={() => setFile(f.uid)}>{f.name}</button>
                ))}
              </span>,
            ])} />
        </div>
      )}
    </Loaded>
    </div>
  );
}

/** Новый тест: TEST-элемент с командой запуска и связями verifies с требованиями. */
function AddTestForm({ projectKey, onClose }: { projectKey: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [command, setCommand] = useState('');
  const [reqs, setReqs] = useState('');
  const [partial, setPartial] = useState('');
  const [workdir, setWorkdir] = useState('');
  const [kind, setKind] = useState('unit');
  const [artifacts, setArtifacts] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = reqs.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await pthApi.createArtifact(projectKey, {
        type: 'TEST', title: title.trim(), text: command.trim() ? `Команда: ${command.trim()}` : '',
        attributes: { ...(command.trim() ? { command: command.trim() } : {}), kind, ...(artifacts.trim() ? { artifacts: artifacts.trim() } : {}), ...(workdir.trim() ? { workdir: workdir.trim() } : {}), ...(partial.trim() ? { coverage: 'partial', coverage_gaps: partial.trim() } : {}) },
      });
      const failed: string[] = [];
      for (const id of ids) {
        try { await pthApi.createRelation(projectKey, { type: 'verifies', source: created.display_id, target: id }); } catch { failed.push(id); }
      }
      setDone(created.display_id);
      if (failed.length) setError(`Тест создан, но не связан с: ${failed.join(', ')} (нет такого требования или недопустимый тип).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать тест');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={onClose}>Назад к тестам</Button></div>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Новый тест">
        <h3 className="text-ui font-semibold">Новый тест</h3>
        <label className="flex flex-col gap-1 text-meta text-text-muted">
          Вид проверки
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
            <option value="unit">функциональные тесты</option>
            <option value="load">нагрузочные испытания</option>
            <option value="static">статический анализ (SonarQube и аналоги)</option>
            <option value="security">поиск уязвимостей</option>
            <option value="other">прочая проверка CI</option>
          </select>
        </label>
        <TextField label="Название" hint="что проверяет" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Команда запуска" hint="аргументы pytest (файл, -k, файл::тест, -m) или полная команда, начиная с {python}" value={command} onChange={(e) => setCommand(e.target.value)} />
        <TextField label="Отчёты для ПСИ" hint="необязательно: маски файлов и папок через пробел, например allure-results report.sarif" value={artifacts} onChange={(e) => setArtifacts(e.target.value)} />
        <TextField label="Папка запуска" hint="необязательно: папка в репозитории, например server; пусто — корень" value={workdir} onChange={(e) => setWorkdir(e.target.value)} />
        <TextField label="Проверяемые требования" hint="ID через запятую: PTH-FR-001, PTH-AC-002" value={reqs} onChange={(e) => setReqs(e.target.value)} />
        <TextField label="Неполный набор: чего тест не проверяет" hint="необязательно; если заполнено, покрытие считается частичным" value={partial} onChange={(e) => setPartial(e.target.value)} />
        <p className="text-meta text-text-muted">Тест запускает post-commit хук: он берёт список тестов с командами прямо из PTH, отдельный файл в репозитории не нужен. Результат появится после следующего коммита.</p>
        {error && <InlineAlert tone="warning" message={error} />}
        {done && <InlineAlert tone="success" message={`Создан ${done}.`} />}
        <div><Button type="submit" variant="primary" disabled={busy || done !== null || title.trim().length < 1} loading={busy}>Создать тест</Button></div>
      </form>
    </div>
  );
}

const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Последовательный список коммитов: новые сверху, линия времени слева, дата и время у каждого. */
function GitTimeline({ history, onOpen }: { history: { added: { sha: string; title: string; date: string } | null; changes: { sha: string; title: string; date: string }[] }; onOpen: (sha: string) => void }) {
  const items = [...history.changes];
  if (history.added && !items.some((c) => c.sha === history.added!.sha)) items.push(history.added);
  items.sort((a, b) => b.date.localeCompare(a.date));
  if (items.length === 0) return <p className="text-ui text-text-muted">В истории Git изменений файлов теста не найдено.</p>;
  return (
    <ol className="flex flex-col border-l border-border pl-4">
      {items.map((c) => {
        const isAdded = history.added?.sha === c.sha;
        return (
          <li key={c.sha} className="relative flex flex-col gap-0.5 pb-3 last:pb-0">
            <span aria-hidden="true" className={`absolute -left-[1.3125rem] top-1.5 size-2.5 rounded-full border ${isAdded ? 'border-accent-text bg-accent-text' : 'border-control-border bg-surface'}`} />
            <span className="flex flex-wrap items-baseline gap-2">
              <time dateTime={c.date} className="text-meta tabular-nums text-text-muted">{dateTime(c.date)}</time>
              <button type="button" className="font-mono text-meta text-accent-text underline underline-offset-2" onClick={() => onOpen(c.sha)}>{c.sha.slice(0, 10)}</button>
              <StatusText label={isAdded ? 'добавлен' : 'изменён'} tone={isAdded ? 'ok' : 'neutral'} />
            </span>
            <span className="text-ui text-text">{c.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

const dateTimeRu = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, few: string, many: string) => {
  const m = n % 100;
  const d = n % 10;
  return m >= 11 && m <= 14 ? many : d === 1 ? one : d >= 2 && d <= 4 ? few : many;
};

const fileSize = (n: number) => (n < 1024 ? `${n} Б` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} КБ` : `${(n / 1024 / 1024).toFixed(1)} МБ`);

/** Просмотр файла запуска: сводка по формату и содержимое. Архивы и бинарные файлы — только сводка и скачивание. */
function AttachmentView({ projectKey, uid }: { projectKey: string; uid: string }) {
  const data = useAsync(`attachment:${projectKey}:${uid}`, () => pthApi.attachmentPreview(projectKey, uid));
  return (
    <Loaded state={data} retry={data.reload}>
      {(f) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-section font-semibold text-text">{f.name}</h3>
              <p className="text-meta text-text-muted">{fileSize(f.size)} · {f.content_type} · sha256 <span className="font-mono">{f.sha256.slice(0, 16)}</span></p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void pthApi.downloadFile(`/v1/projects/${projectKey}/attachments/${uid}`, f.name)}>Скачать</Button>
          </div>
          {f.summary && (
            <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4 text-ui">
              <h3 className="font-semibold">Сводка</h3>
              {f.summary.type === 'allure' && (<>
                <p>Allure: всего {f.summary.total} ({Object.entries(f.summary.counts).map(([k, v]) => `${v} ${k}`).join(', ')}); суммарное время {f.summary.seconds} с</p>
                {f.summary.failed.map((n) => <p key={n} className="text-danger-text">не пройден: {n}</p>)}
              </>)}
              {f.summary.type === 'sarif' && (<>
                <p>{f.summary.tools.join('; ')}: {f.summary.total} находок ({Object.entries(f.summary.levels).map(([k, v]) => `${v} ${k}`).join(', ') || 'нет'})</p>
                {f.summary.top_rules.map(([rule, n]) => <p key={rule} className="text-meta text-text-muted">правило <span className="font-mono">{rule}</span>: {n}</p>)}
              </>)}
              {f.summary.type === 'quality_gate' && (<>
                <p>Quality gate: {f.summary.status}</p>
                {f.summary.failed.map((n) => <p key={n} className="text-danger-text">не выполнено: {n}</p>)}
              </>)}
            </div>
          )}
          {f.text !== null ? (
            <>
              {f.truncated && <InlineAlert tone="warning" message="Показано начало файла (200 КБ). Полный файл — по кнопке «Скачать»." />}
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-card border border-border bg-surface p-4 font-mono text-meta text-text">{f.text}</pre>
            </>
          ) : <p className="text-ui text-text-muted">Содержимое этого типа файла не показывается в окне. Скачайте файл, чтобы открыть его.</p>}
        </div>
      )}
    </Loaded>
  );
}
