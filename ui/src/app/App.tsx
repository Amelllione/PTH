import { useState, type FormEvent } from 'react';
import type { ArtifactType, ExtractionJob, ImportMode, ImportReport, Proposal } from '@/entities/pth/types';
import { GraphExplorer } from '@/features/graph/GraphExplorer';
import { CreateProjectForm } from '@/features/projects/CreateProjectForm';
import { ProjectSwitcher } from '@/features/projects/ProjectSwitcher';
import { ExtractPanel } from '@/features/extract/ExtractPanel';
import { CodeScreen } from '@/features/screens/CodeScreen';
import { ImpactScreen } from '@/features/screens/ImpactScreen';
import { OverviewScreen } from '@/features/screens/OverviewScreen';
import { RegistryScreen } from '@/features/screens/RegistryScreen';
import { ReleaseScreen } from '@/features/screens/ReleaseScreen';
import { ReviewScreen } from '@/features/screens/ReviewScreen';
import { MatrixScreen } from '@/features/screens/MatrixScreen';
import { SourceScreen } from '@/features/screens/SourceScreen';
import { SettingsScreen } from '@/features/screens/SettingsScreen';
import { VerificationScreen } from '@/features/screens/VerificationScreen';
import { useEffect } from 'react';
import { ImportForm } from '@/features/import/ImportForm';
import { ChangeSetList } from '@/features/import/ChangeSetList';
import { ImportJournal } from '@/features/import/ImportJournal';
import { ImportReportView } from '@/features/import/ImportReportView';
import { LostRequirementsList, type PriorityFilter } from '@/features/lost/LostRequirementsList';
import { pthApi, readToken, saveToken } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, EmptyState, ErrorState, Pager, SkeletonList, Tabs, TextField } from '@/shared/ui';

type Section = 'overview' | 'registry' | 'lost' | 'graph' | 'impact' | 'review' | 'verify' | 'code' | 'release' | 'import' | 'source' | 'matrix' | 'settings';
const SECTIONS: Section[] = ['overview', 'registry', 'lost', 'graph', 'impact', 'review', 'verify', 'code', 'release', 'import', 'source', 'matrix', 'settings'];

/** Вкладка отражается в адресе (#registry), поэтому страницу можно открыть и поделиться ссылкой (§12.5). */
function sectionFromHash(): Section {
  const id = window.location.hash.replace('#', '').split('?')[0] as Section;
  return SECTIONS.includes(id) ? id : 'overview';
}

/** Фильтр из адреса: #registry?type=FR открывает реестр уже отфильтрованным. */
function filterFromHash(): { type: string } {
  const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return { type: query.get('type') ?? '' };
}

/** Корневой экран: два раздела — потерянные элементы и граф. Данные — только через pthApi. */
export function App() {
  const [projectKey, setProjectKey] = useState('PTH');
  const [tokenDraft, setTokenDraft] = useState(readToken);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const projects = useAsync(`projects:${projectsVersion}`, () => pthApi.projects());
  const [section, setSectionState] = useState<Section>(sectionFromHash);
  const [registryFilter, setRegistryFilter] = useState<{ type: string }>(filterFromHash);
  const [registryKey, setRegistryKey] = useState(0);
  const setSection = (next: Section, filter?: { type?: string }) => {
    setSectionState(next);
    if (next === 'registry') {
      const type = filter?.type ?? '';
      setRegistryFilter({ type });
      setRegistryKey((k) => k + 1);
      window.history.replaceState(null, '', `#registry${type ? `?type=${type}` : ''}`);
    } else {
      window.history.replaceState(null, '', `#${next}`);
    }
  };
  useEffect(() => {
    const onHash = () => {
      setSectionState(sectionFromHash());
      setRegistryFilter(filterFromHash());
      setRegistryKey((k) => k + 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [relationFilter, setRelationFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | ArtifactType>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [focus, setFocus] = useState<string | null>(null);
  const [focusDraft, setFocusDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [journalVersion, setJournalVersion] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [openImportUid, setOpenImportUid] = useState<string | null>(null);
  const [changesetVersion, setChangesetVersion] = useState(0);
  const [applyingUid, setApplyingUid] = useState<string | null>(null);
  const [modelsVersion, setModelsVersion] = useState(0);
  const models = useAsync(
    section === 'import' ? `llm-models:${modelsVersion}` : null,
    () => pthApi.llmModels(),
  );
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<{ proposals: Proposal[]; skipped: number; model: string } | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [jobUid, setJobUid] = useState<string | null>(null);
  const [job, setJob] = useState<ExtractionJob | null>(null);

  // опрос фоновой задачи раз в 2 с; останавливается, когда задача завершилась
  useEffect(() => {
    if (!jobUid) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const current = await pthApi.job(projectKey, jobUid);
        if (stopped) return;
        setJob(current);
        if (current.state === 'succeeded' || current.state === 'failed') {
          stopped = true;
          clearInterval(timer);
          setExtractResult({ proposals: current.proposals, skipped: current.skipped, model: current.model });
        }
      } catch (error) {
        if (!stopped) setExtractError(error instanceof Error ? error.message : 'Нет связи с сервером');
      }
    };
    const timer = setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [jobUid, projectKey]);

  const startJob = async (model: string, sourceName: string, text: string) => {
    setExtractError(null);
    setExtractResult(null);
    try {
      const created = await pthApi.startJob(projectKey, { model, source_name: sourceName, text });
      setJob(created);
      setJobUid(created.uid);
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : 'Не удалось запустить выделение');
    }
  };

  const runExtract = async (model: string, text: string) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const r = await pthApi.extract(projectKey, model, text);
      setExtractResult({ proposals: r.proposals, skipped: r.skipped, model: r.model });
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : 'Не удалось выделить требования');
    } finally {
      setExtracting(false);
    }
  };

  const createDraftFromProposals = async (title: string, proposals: Proposal[]) => {
    setDraftBusy(true);
    setExtractError(null);
    try {
      await pthApi.proposalsToChangeSet(projectKey, title, proposals);
      setChangesetVersion((v) => v + 1);
      setExtractResult(null);
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : 'Не удалось создать черновик');
    } finally {
      setDraftBusy(false);
    }
  };
  const [applyError, setApplyError] = useState<string | null>(null);
  const [csPage, setCsPage] = useState(0);
  const [journalPage, setJournalPage] = useState(0);
  const [lostPage, setLostPage] = useState(0);
  const [lostSize, setLostSize] = useState(20);
  // Сначала несвязанные с кодом: это первый этап, реализация идёт позже.
  const [reasonFilter, setReasonFilter] = useState<'all' | 'no_code_link' | 'no_reflection'>('all');
  const changesets = useAsync(
    section === 'import' ? `changesets:${projectKey}:${changesetVersion}:${csPage}` : null,
    () => pthApi.changesetsPage(projectKey, csPage * 20, 20),
  );

  const journal = useAsync(
    section === 'import' ? `imports:${projectKey}:${journalVersion}:${journalPage}` : null,
    () => pthApi.importsPage(projectKey, journalPage * 20, 20),
  );
  const openImport = useAsync(
    section === 'import' && openImportUid ? `import:${projectKey}:${openImportUid}` : null,
    () => pthApi.importDetail(projectKey, openImportUid ?? ''),
  );

  const runImport = async (input: { sourceName: string; text: string }, mode: ImportMode) => {
    setImportBusy(true);
    setImportError(null);
    try {
      const report = await pthApi.importSpec(projectKey, { source_name: input.sourceName, text: input.text }, mode);
      setImportReport(report);
      setOpenImportUid(null);
      if (mode === 'apply') setJournalVersion((v) => v + 1);
      if (mode === 'changeset') setChangesetVersion((v) => v + 1);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Импорт не выполнен');
    } finally {
      setImportBusy(false);
    }
  };

  const lost = useAsync(
    section === 'lost' ? `lost:${projectKey}:${typeFilter}:${priorityFilter}:${reasonFilter}:${lostPage}:${lostSize}` : null,
    () =>
      pthApi.lostPage(
        projectKey,
        lostPage * lostSize,
        lostSize,
        typeFilter === 'ALL' ? undefined : typeFilter,
        priorityFilter === 'ALL' ? undefined : priorityFilter,
        reasonFilter === 'all' ? undefined : reasonFilter,
      ),
  );
  const graph = useAsync(
    section === 'graph' && focus ? `graph:${projectKey}:${focus}:${relationFilter.join(',')}` : null,
    () => pthApi.graph(projectKey, focus ?? '', 2, relationFilter),
  );
  const detail = useAsync(
    section === 'graph' && selected ? `detail:${projectKey}:${selected}` : null,
    () => pthApi.artifact(projectKey, selected ?? ''),
  );
  const revisions = useAsync(
    section === 'graph' && selected ? `revisions:${projectKey}:${selected}` : null,
    () => pthApi.revisions(projectKey, selected ?? ''),
  );

  const openOnGraph = (displayId: string) => {
    setFocus(displayId);
    setFocusDraft(displayId);
    setSelected(displayId);
    setSection('graph');
  };

  const applyChangeset = async (uid: string) => {
    setApplyingUid(uid);
    setApplyError(null);
    try {
      await pthApi.applyChangeset(projectKey, uid);
      setJournalVersion((v) => v + 1);
      setChangesetVersion((v) => v + 1);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Не удалось применить');
      setChangesetVersion((v) => v + 1);
    } finally {
      setApplyingUid(null);
    }
  };

  const switchProject = (key: string) => {
    setProjectKey(key);
    setFocus(null);
    setSelected(null);
    setImportReport(null);
    setOpenImportUid(null);
    setCreatingProject(false);
  };

  const createProject = async (key: string, name: string) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      await pthApi.createProject(key, name);
      setProjectsVersion((v) => v + 1);
      switchProject(key);
      setSection('import'); // следующий шаг после создания — загрузка спеки
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Не удалось создать проект');
    } finally {
      setCreateBusy(false);
    }
  };

  const submitFocus = (event: FormEvent) => {
    event.preventDefault();
    const id = focusDraft.trim().toUpperCase();
    if (id) {
      setFocus(id);
      setSelected(id);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 bg-canvas p-4 text-text">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-screen font-semibold">Project Traceability Hub</h1>
          <p className="text-meta text-text-muted">Потерянные элементы и граф трассировки</p>
        </div>
        <form
          aria-label="Токен доступа"
          onSubmit={(e) => {
            e.preventDefault();
            saveToken(tokenDraft.trim());
            window.location.reload(); // все запросы перечитываются с новым токеном
          }}
          className="flex items-end gap-2"
        >
          <TextField label="Токен" type="password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} className="w-56" autoComplete="off" />
          <Button type="submit" variant="secondary">Сохранить токен</Button>
        </form>
        <ProjectSwitcher
          projects={projects.data ?? []}
          value={projectKey}
          onChange={switchProject}
          onCreate={() => {
            setCreateError(null);
            setCreatingProject(true);
          }}
        />
      </header>

      {creatingProject && (
        <CreateProjectForm
          busy={createBusy}
          error={createError}
          onSubmit={createProject}
          onCancel={() => setCreatingProject(false)}
        />
      )}

      <p className="text-meta text-text-muted">
        Текущий проект: <span className="font-mono text-text">{projectKey}</span>.
        {projects.data && !projects.data.some((x) => x.key === projectKey) && ' Он ещё не создан — нажмите «Новый проект».'}
      </p>

      <Tabs
        label="Разделы"
        idPrefix="main"
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'registry', label: 'Реестр' },
          { id: 'lost', label: 'Потерянные' },
          { id: 'graph', label: 'Граф' },
          { id: 'impact', label: 'Влияние' },
          { id: 'review', label: 'Замечания' },
          { id: 'verify', label: 'Проверка' },
          { id: 'code', label: 'Код' },
          { id: 'release', label: 'Релиз' },
          { id: 'matrix', label: 'Матрица' },
          { id: 'import', label: 'Импорт' },
          { id: 'source', label: 'Источник' },
          { id: 'settings', label: 'Настройки' },
        ]}
        selectedId={section}
        onChange={(id) => setSection(id as Section)}
      />

      <div role="tabpanel" id={`main-panel-${section}`} aria-labelledby={`main-tab-${section}`}>
        {section === 'overview' && <OverviewScreen projectKey={projectKey} onOpenSection={(s, f) => setSection(s as Section, f)} />}
        {section === 'registry' && <RegistryScreen key={registryKey} projectKey={projectKey} initialType={registryFilter.type} />}
        {section === 'impact' && <ImpactScreen projectKey={projectKey} />}
        {section === 'review' && <ReviewScreen projectKey={projectKey} />}
        {section === 'verify' && <VerificationScreen projectKey={projectKey} />}
        {section === 'code' && <CodeScreen projectKey={projectKey} />}
        {section === 'release' && <ReleaseScreen projectKey={projectKey} />}
        {section === 'settings' && <SettingsScreen projectKey={projectKey} />}
        {section === 'matrix' && <MatrixScreen projectKey={projectKey} />}
        {section === 'source' && <SourceScreen projectKey={projectKey} />}

        {section === 'lost' && (
          <>
            {lost.loading && <SkeletonList rows={4} />}
            {lost.error && <ErrorState title="Не удалось загрузить список" description={lost.error} action={<Button onClick={lost.reload}>Повторить</Button>} />}
            {lost.data && (
              <>
                <LostRequirementsList
                  footer={
                    <Pager page={lostPage} pageSize={lostSize} total={lost.data.total} onPage={setLostPage}
                      onPageSize={(v) => { setLostSize(v); setLostPage(0); }} label="Страницы потерянных" />
                  }
                  items={lost.data.items}
                  excluded={lost.data.excluded}
                  typeFilter={typeFilter}
                  onTypeChange={(v) => { setLostPage(0); setTypeFilter(v); }}
                  priorityFilter={priorityFilter}
                  onPriorityChange={(v) => { setLostPage(0); setPriorityFilter(v); }}
                  reasonFilter={reasonFilter}
                  onReasonChange={(v) => { setLostPage(0); setReasonFilter(v); }}
                  onOpen={openOnGraph}
                />
              </>
            )}
          </>
        )}

        {section === 'import' && (
          <div className="flex flex-col gap-6">
            <p className="text-ui text-text">
              Спецификация загрузится в проект <span className="font-mono">{projectKey}</span>. Сначала проверьте без записи, затем примените.
            </p>
            <ExtractPanel
              models={models.data}
              modelsLoading={models.loading}
              modelsError={models.error}
              onRetryModels={() => setModelsVersion((v) => v + 1)}
              onExtract={runExtract}
              extracting={extracting}
              extractError={extractError}
              result={extractResult}
              onCreateDraft={createDraftFromProposals}
              creating={draftBusy}
              onStartJob={startJob}
              job={job}
            />
            <ImportForm busy={importBusy} error={importError} onSubmit={runImport} />
            {importReport && <ImportReportView report={importReport} />}
            <section aria-label="Черновики" className="flex flex-col gap-3">
              <h2 className="text-section font-semibold">Черновики ChangeSet</h2>
              {applyError && <p role="alert" className="text-meta text-danger-text">{applyError}</p>}
              {changesets.loading && <SkeletonList rows={1} />}
              {changesets.error && <ErrorState title="Не удалось загрузить черновики" description={changesets.error} />}
              {changesets.data && (
                <>
                <ChangeSetList
                  items={changesets.data.items}
                  applyingUid={applyingUid}
                  onApply={applyChangeset}
                  onSave={async (uid, operations) => {
                    await pthApi.editChangeset(projectKey, uid, { operations });
                    setChangesetVersion((v) => v + 1);
                  }}
                />
                <Pager page={csPage} pageSize={20} total={changesets.data.total} onPage={setCsPage} label="Страницы черновиков" />
                </>
              )}
            </section>
            <section aria-label="Журнал импортов" className="flex flex-col gap-3">
              <h2 className="text-section font-semibold">Журнал</h2>
              {journal.loading && <SkeletonList rows={2} />}
              {journal.error && <ErrorState title="Не удалось загрузить журнал" description={journal.error} action={<Button onClick={journal.reload}>Повторить</Button>} />}
              {journal.data && (
                <>
                  <ImportJournal items={journal.data.items} onOpen={setOpenImportUid} />
                  <Pager page={journalPage} pageSize={20} total={journal.data.total} onPage={setJournalPage} label="Страницы импортов" />
                </>
              )}
              {openImport.loading && <SkeletonList rows={2} />}
              {openImport.error && <ErrorState title="Импорт не найден" description={openImport.error} />}
              {openImport.data && <ImportReportView report={openImport.data} />}
            </section>
          </div>
        )}

        {section === 'graph' && (
          <div className="flex flex-col gap-4">
            <form onSubmit={submitFocus} className="flex flex-wrap items-end gap-2">
              <TextField
                label="Артефакт в центре"
                hint="Например PTH-US-001"
                value={focusDraft}
                onChange={(e) => setFocusDraft(e.target.value)}
                className="w-72"
              />
              <Button type="submit" variant="secondary">Построить</Button>
            </form>
            {!focus && <EmptyState title="Центр не выбран" description="Укажите артефакт или откройте элемент из раздела «Потерянные»." />}
            {focus && graph.loading && <SkeletonList rows={3} />}
            {focus && graph.error && <ErrorState title="Не удалось построить граф" description={graph.error} action={<Button onClick={graph.reload}>Повторить</Button>} />}
            {focus && graph.data && (
              <>
              <fieldset className="flex flex-wrap items-center gap-3 text-ui">
                <legend className="mr-2 text-meta text-text-muted">Типы связей</legend>
                {['refines', 'motivates', 'implements', 'verifies'].map((rt) => (
                  <label key={rt} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={relationFilter.length === 0 || relationFilter.includes(rt)}
                      onChange={(e) => {
                        const all = ['refines', 'motivates', 'implements', 'verifies'];
                        const current = relationFilter.length === 0 ? all : relationFilter;
                        const next = e.target.checked ? [...current, rt] : current.filter((x) => x !== rt);
                        setRelationFilter(next.length === all.length ? [] : next);
                      }}
                    />
                    {rt}
                  </label>
                ))}
              </fieldset>
              <GraphExplorer
                graph={graph.data}
                selected={selected}
                detail={detail.data}
                detailLoading={detail.loading}
                detailError={detail.error}
                revisions={revisions.data}
                onSelect={setSelected}
                onFocus={openOnGraph}
              />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
