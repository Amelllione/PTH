import { Fragment } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Loaded, Section } from './common';
import { ArtifactEditor } from './ArtifactEditor';
import { useState } from 'react';
import { Button } from '@/shared/ui';

/** Карточка элемента: текст, атрибуты, связи в проекте и история ревизий. Используется в реестре и во влиянии. */
export function ArtifactCard({ projectKey, displayId }: { projectKey: string; displayId: string }) {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);
  const detail = useAsync(`card:${projectKey}:${displayId}:${version}`, () => pthApi.artifact(projectKey, displayId));
  const revisions = useAsync(`revs:${projectKey}:${displayId}`, () => pthApi.revisions(projectKey, displayId));
  const relations = useAsync(`rels:${projectKey}:${displayId}`, () => pthApi.relations(projectKey));
  return (
    <Section title={`Карточка ${displayId}`}>
      <Loaded state={detail} retry={detail.reload}>
        {(d) => editing ? (
          <ArtifactEditor projectKey={projectKey} card={d}
            onSaved={() => { setEditing(false); setVersion((v) => v + 1); }}
            onCancel={() => setEditing(false)} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <h3 className="text-ui font-semibold">{d.title}</h3>
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-ui text-text">{d.text || 'Текст не задан.'}</p>
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Редактировать</Button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
                <dt className="text-text-muted">тип</dt><dd>{d.type}</dd>
                <dt className="text-text-muted">ревизия</dt><dd>{d.revision}</dd>
                <dt className="text-text-muted">внешний ключ</dt><dd className="font-mono">{d.external_key ?? '—'}</dd>
                {Object.entries(d.attributes).map(([k, v]) => (
                  <Fragment key={k}><dt className="text-text-muted">{k}</dt><dd>{String(v)}</dd></Fragment>
                ))}
              </dl>
              {d.exemption_reason && <p className="text-meta text-text-muted">Исключение: {d.exemption_reason}</p>}
            </div>
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <h3 className="text-ui font-semibold">Связи</h3>
              <Loaded state={relations} retry={relations.reload}>
                {(all) => {
                  const mine = all.filter((r) => r.source === displayId || r.target === displayId);
                  return mine.length === 0 ? <p className="text-ui text-text-muted">Связей нет.</p> : (
                    <ul className="flex flex-col gap-1 font-mono text-meta">
                      {mine.map((r) => <li key={r.uid}>{r.source} —{r.type}→ {r.target}</li>)}
                    </ul>
                  );
                }}
              </Loaded>
              <h3 className="mt-2 text-ui font-semibold">История ревизий</h3>
              <Loaded state={revisions} retry={revisions.reload}>
                {(revs) => (
                  <ol className="flex flex-col gap-1 text-meta">
                    {[...revs].reverse().map((r) => <li key={r.number}>ревизия {r.number}: {r.title}</li>)}
                  </ol>
                )}
              </Loaded>
            </div>
          </div>
        )}
      </Loaded>
    </Section>
  );
}
