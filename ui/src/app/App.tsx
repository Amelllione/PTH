import { useState, type FormEvent } from 'react';
import type { ArtifactType } from '@/entities/pth/types';
import { GraphExplorer } from '@/features/graph/GraphExplorer';
import { CreateProjectForm } from '@/features/projects/CreateProjectForm';
import { ProjectSwitcher } from '@/features/projects/ProjectSwitcher';
import { CodeScreen } from '@/features/screens/CodeScreen';
import { ImpactScreen } from '@/features/screens/ImpactScreen';
import { OverviewScreen } from '@/features/screens/OverviewScreen';
import { RegistryScreen } from '@/features/screens/RegistryScreen';
import { ReleaseScreen } from '@/features/screens/ReleaseScreen';
import { ReviewScreen } from '@/features/screens/ReviewScreen';
import { SourceScreen } from '@/features/screens/SourceScreen';
import { SettingsScreen } from '@/features/screens/SettingsScreen';
import { VerificationScreen } from '@/features/screens/VerificationScreen';
import { useEffect } from 'react';
import { DiagramsScreen } from '@/features/screens/DiagramsScreen';
import { ImportScreen } from '@/features/screens/ImportScreen';
import { ChangesScreen } from '@/features/screens/ChangesScreen';
import { LostRequirementsList, type PriorityFilter } from '@/features/lost/LostRequirementsList';
import { pthApi, readToken, saveToken } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, EmptyState, ErrorState, Pager, SkeletonList, TextField } from '@/shared/ui';
import { SideNav, type NavGroup } from './SideNav';
import type { GraphLayoutMode } from '@/features/graph/layout';
import { SourceNavContext, type SourceFocus } from '@/shared/lib/sourceNav';

type Section = 'overview' | 'registry' | 'diagrams' | 'changes' | 'lost' | 'graph' | 'impact' | 'review' | 'verify' | 'code' | 'release' | 'import' | 'source' | 'settings';
const SECTIONS: Section[] = ['overview', 'registry', 'diagrams', 'changes', 'lost', 'graph', 'impact', 'review', 'verify', 'code', 'release', 'import', 'source', 'settings'];

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
  // Переход к источнику из карточки требования: документ, строка и требование.
  const [sourceFocus, setSourceFocus] = useState<SourceFocus | null>(null);
  const openSource = (focus: SourceFocus) => {
    setSourceFocus(focus);
    setSection('source');
  };
  // Сколько уровней связей от центра показывать на графе и как их раскладывать.
  const [graphDepth, setGraphDepth] = useState(2);
  const [graphLayout, setGraphLayout] = useState<GraphLayoutMode>('links');
  const [lostPage, setLostPage] = useState(0);
  const [lostSize, setLostSize] = useState(20);
  // Сначала несвязанные с кодом: это первый этап, реализация идёт позже.
  const [reasonFilter, setReasonFilter] = useState<'no_code_link' | 'no_reflection'>('no_reflection');
  const lost = useAsync(
    section === 'lost' ? `lost:${projectKey}:${typeFilter}:${priorityFilter}:${reasonFilter}:${lostPage}:${lostSize}` : null,
    () =>
      pthApi.lostPage(
        projectKey,
        lostPage * lostSize,
        lostSize,
        typeFilter === 'ALL' ? undefined : typeFilter,
        priorityFilter === 'ALL' ? undefined : priorityFilter,
        reasonFilter,
      ),
  );
  const graph = useAsync(
    section === 'graph' && focus ? `graph:${projectKey}:${focus}:${graphDepth}:${relationFilter.join(',')}` : null,
    () => pthApi.graph(projectKey, focus ?? '', graphDepth, relationFilter),
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

  const switchProject = (key: string) => {
    setProjectKey(key);
    setFocus(null);
    setSelected(null);
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

  const groups: NavGroup[] = [
    { title: 'Проект', items: [{ id: 'overview', label: 'Обзор' }] },
    { title: 'Требования', items: [
      { id: 'registry', label: 'Реестр' }, { id: 'diagrams', label: 'Схемы' },
      { id: 'graph', label: 'Граф' }, { id: 'lost', label: 'Потерянные' }, { id: 'impact', label: 'Влияние' }, { id: 'review', label: 'Замечания' },
    ] },
    { title: 'Реализация', items: [{ id: 'code', label: 'Код' }, { id: 'verify', label: 'Проверка' }, { id: 'release', label: 'Релиз' }] },
    { title: 'Данные', items: [{ id: 'import', label: 'Импорт' }, { id: 'changes', label: 'Изменения' }, { id: 'source', label: 'Источник' }] },
    { title: 'Система', items: [{ id: 'settings', label: 'Настройки' }] },
  ];

  return (
    <SourceNavContext.Provider value={openSource}>
    <div className="flex min-h-dvh flex-col bg-canvas text-text lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-border p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div>
          <h1 className="text-section font-semibold">Project Traceability Hub</h1>
          <p className="text-meta text-text-muted">Трассировка требований</p>
        </div>
        <ProjectSwitcher
          projects={projects.data ?? []}
          value={projectKey}
          onChange={switchProject}
          onCreate={() => {
            setCreateError(null);
            setCreatingProject(true);
          }}
        />
        <SideNav groups={groups} selectedId={section} onSelect={(id) => setSection(id as Section)} />
        <details className="mt-auto text-ui">
          <summary className="cursor-pointer text-meta text-text-muted">Токен доступа</summary>
          <form
            aria-label="Токен доступа"
            onSubmit={(e) => {
              e.preventDefault();
              saveToken(tokenDraft.trim());
              window.location.reload(); // все запросы перечитываются с новым токеном
            }}
            className="mt-2 flex flex-col gap-2"
          >
            <TextField label="Токен" type="password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} autoComplete="off" />
            <Button type="submit" variant="secondary" size="sm">Сохранить токен</Button>
          </form>
        </details>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:p-6">
      {creatingProject && (
        <CreateProjectForm
          busy={createBusy}
          error={createError}
          onSubmit={createProject}
          onCancel={() => setCreatingProject(false)}
        />
      )}

      {projects.data && !projects.data.some((x) => x.key === projectKey) && (
        <p className="text-meta text-text-muted">Проект <span className="font-mono text-text">{projectKey}</span> ещё не создан — нажмите «Новый проект».</p>
      )}

      <div role="tabpanel" id={`main-panel-${section}`} aria-labelledby={`main-tab-${section}`}>
        {section === 'overview' && <OverviewScreen projectKey={projectKey} onOpenSection={(s, f) => setSection(s as Section, f)} />}
        {section === 'registry' && <RegistryScreen key={registryKey} projectKey={projectKey} initialType={registryFilter.type} />}
        {section === 'diagrams' && <DiagramsScreen projectKey={projectKey} />}
        {section === 'impact' && <ImpactScreen projectKey={projectKey} />}
        {section === 'review' && <ReviewScreen projectKey={projectKey} />}
        {section === 'verify' && <VerificationScreen projectKey={projectKey} />}
        {section === 'code' && <CodeScreen projectKey={projectKey} />}
        {section === 'release' && <ReleaseScreen projectKey={projectKey} />}
        {section === 'settings' && <SettingsScreen projectKey={projectKey} />}
        {section === 'source' && <SourceScreen key={projectKey} projectKey={projectKey} focus={sourceFocus} />}

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

        {section === 'import' && <ImportScreen projectKey={projectKey} />}
        {section === 'changes' && <ChangesScreen key={projectKey} projectKey={projectKey} />}

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
                {['refines', 'motivates', 'implements', 'verifies', 'illustrates'].map((rt) => (
                  <label key={rt} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={relationFilter.length === 0 || relationFilter.includes(rt)}
                      onChange={(e) => {
                        const all = ['refines', 'motivates', 'implements', 'verifies', 'illustrates'];
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
                depth={graphDepth}
                onDepth={setGraphDepth}
                layoutMode={graphLayout}
                onLayoutMode={setGraphLayout}
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
      </main>
    </div>
    </SourceNavContext.Provider>
  );
}
