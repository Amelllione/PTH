import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { useState } from 'react';
import { FlowGraph } from '@/features/graph/FlowGraph';
import { pthApi as api } from '@/shared/api/pthApi';
import { Badge, Pager } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';

/** Матрица: требование × источник, ФТ, коммиты, тесты и соответствие. Собрана из данных API. */
export function MatrixScreen({ projectKey }: { projectKey: string }) {
  const [view, setView] = useState<'graph' | 'table'>('table');
  const [matPage, setMatPage] = useState(0);
  const MAT = 20;
  const [focusId, setFocusId] = useState<string | null>(null);
  const data = useAsync(`matrix:${projectKey}`, async () => {
    const [arts, rels, commits, compliance, imports] = await Promise.all([
      pthApi.artifactsPage(projectKey, 0, 500).then((r) => r.items),  // все элементы, не первые 100
      pthApi.relations(projectKey),
      pthApi.commits(projectKey),
      pthApi.compliance(projectKey),
      pthApi.imports(projectKey),
    ]);
    const sourceOf = new Map<string, string>();
    for (const imp of imports) {
      if (!imp.uid) continue;
      const src = await pthApi.source(projectKey, imp.uid);
      for (const l of src.lines) if (l.display_id) sourceOf.set(l.display_id, src.source_name);
    }
    return { arts, rels, commits, compliance, sourceOf };
  });

  return (
    <Section title="Матрица трассировки" hint="Строка — требование. Колонки собраны из связей, коммитов, проверок и исходного документа.">
      <Loaded state={data} retry={data.reload} empty={{ title: 'Требований нет', isEmpty: (d) => d.arts.length === 0 }}>
        {(d) => {
          const status = new Map(d.compliance.items.map((i) => [i.display_id, i.status]));
          const rows = d.arts.filter((a) => ['US', 'FR', 'NFR', 'AC'].includes(a.type));
          const linked = (id: string, type: string, direction: 'in' | 'out') =>
            d.rels.filter((r) => r.type === type && (direction === 'out' ? r.source : r.target) === id)
              .map((r) => (direction === 'out' ? r.target : r.source));
          if (view === 'graph') {
            return (
              <>
                <div role="group" aria-label="Вид" className="flex gap-3 text-ui">
                  <button type="button" className="font-medium text-accent-text underline underline-offset-2" aria-pressed="true">граф</button>
                  <button type="button" className="text-text-muted underline underline-offset-2" onClick={() => setView('table')}>таблица</button>
                </div>
                <label className="flex flex-col gap-1 text-meta text-text-muted">
                  Требование в центре графа
                  <select value={focusId ?? ''} onChange={(e) => setFocusId(e.target.value || null)}
                    className="h-9 min-w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
                    <option value="">выберите требование</option>
                    {rows.map((a) => <option key={a.display_id} value={a.display_id}>{a.display_id} · {a.title.slice(0, 60)}</option>)}
                  </select>
                </label>
                {!focusId && <p className="text-ui text-text-muted">Граф строится для одного требования: его источник, уточнения, коммиты и тесты.</p>}
                {focusId && <FocusGraph projectKey={projectKey} focusId={focusId} />}
              </>
            );
          }
          return (
            <>
            <div role="group" aria-label="Вид" className="flex gap-2">
              <button type="button" className="font-medium text-text-muted underline underline-offset-2" onClick={() => setView('graph')}>граф</button>
              <button type="button" className="font-medium text-accent-text underline underline-offset-2" aria-pressed="true">таблица</button>
            </div>
            <DataTable
              caption="Матрица трассировки"
              headers={['Требование', 'Источник', 'Уточняет', 'Реализует коммит', 'Тесты', 'Соответствие']}
              columns="8.5rem minmax(0,0.8fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,0.9fr) 8rem"
              footer={<Pager page={matPage} pageSize={MAT} total={rows.length} onPage={setMatPage} label="Страницы матрицы" />}
              rows={rows.slice(matPage * MAT, (matPage + 1) * MAT).map((a) => {
                const commits = d.commits.filter((c) => c.implements.includes(a.display_id)).map((c) => c.sha ?? c.display_id);
                const tests = linked(a.display_id, 'verifies', 'in');
                const refines = a.type === 'US' ? linked(a.display_id, 'refines', 'in') : linked(a.display_id, 'refines', 'out');
                return [
                  <span key="id" className="font-mono text-meta">{a.display_id}</span>,
                  d.sourceOf.get(a.display_id) ?? '—',
                  refines.join(', ') || '—',
                  commits.join(', ') || '—',
                  tests.join(', ') || '—',
                  <Badge key="s" label={status.get(a.display_id) ?? 'нет данных'} tone={status.get(a.display_id) === 'verified' ? 'success' : 'neutral'} />,
                ];
              })}
            />
            </>
          );
        }}
      </Loaded>
    </Section>
  );
}

/** Граф одного требования: окрестность в один шаг по связям. Данные — из эндпоинта графа. */
function FocusGraph({ projectKey, focusId }: { projectKey: string; focusId: string }) {
  const graph = useAsync(`matrix-focus:${projectKey}:${focusId}`, () => api.graph(projectKey, focusId, 1));
  return (
    <Loaded state={graph} retry={graph.reload}>
      {(g) => (
        <FlowGraph nodes={g.nodes} edges={g.edges} focus={g.focus} selected={focusId} onSelect={() => {}} height={460} />
      )}
    </Loaded>
  );
}
