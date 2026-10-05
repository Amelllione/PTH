import { Fragment, useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';

export function RegistryScreen({ projectKey }: { projectKey: string }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [submitted, setSubmitted] = useState({ q: '', type: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE = 20;
  const list = useAsync(`registry:${projectKey}:${submitted.q}:${submitted.type}:${page}`, async () => {
    if (submitted.q) {
      const found = await pthApi.search(projectKey, submitted.q, submitted.type || undefined);
      return { items: found.slice(0, PAGE), total: found.length };
    }
    return pthApi.artifactsPage(projectKey, page * PAGE, PAGE, submitted.type || undefined);
  });
  const detail = useAsync(selected ? `card:${projectKey}:${selected}` : null, () => pthApi.artifact(projectKey, selected ?? ''));
  const revisions = useAsync(selected ? `revs:${projectKey}:${selected}` : null, () => pthApi.revisions(projectKey, selected ?? ''));
  const relations = useAsync(selected ? `rels:${projectKey}:${selected}` : null, () => pthApi.relations(projectKey));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Реестр" hint="Поиск по ID, названию и тексту текущих ревизий. Выберите элемент, чтобы открыть карточку.">
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted({ q: query.trim(), type }); }}>
          <TextField label="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} className="w-72" />
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Тип
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="">все</option>
              {['US', 'FR', 'NFR', 'AC', 'ADR', 'TEST', 'COMMIT'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <Button type="submit" variant="secondary">Найти</Button>
        </form>
        <Loaded state={list} retry={list.reload} empty={{ title: 'Ничего не найдено', description: 'Измените запрос или тип.', isEmpty: (d) => d.items.length === 0 }}>
          {({ items: rows, total }) => (
            <DataTable
              caption="Элементы проекта"
              columns="8rem 5rem minmax(0,1fr) 6rem 7rem"
              headers={['ID', 'Тип', 'Название', 'Ревизия', 'Исключение']}
              footer={
                submitted.q ? (
                  <span className="text-meta text-text-muted">Совпадений: {total}{total > rows.length ? `, показаны первые ${rows.length}` : ''}. Для полного списка очистите поиск.</span>
                ) : (
                  <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} label="Страницы реестра" />
                )
              }
              rows={rows.map((r) => [
                <button key="id" type="button" className="font-mono text-meta text-accent-text underline-offset-2 hover:underline" onClick={() => setSelected(r.display_id)} aria-pressed={selected === r.display_id}>{r.display_id}</button>,
                <span key="t" className="text-meta font-semibold text-text-muted">{r.type}</span>,
                <span key="n" className="text-text">{r.title}</span>,
                String(r.revision),
                r.exemption_reason ? 'да' : '—',
              ])}
            />
          )}
        </Loaded>
      </Section>

      {selected && (
        <Section title={`Карточка ${selected}`}>
          <Loaded state={detail} retry={detail.reload}>
            {(d) => (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                  <h3 className="text-ui font-semibold">{d.title}</h3>
                  <p className="whitespace-pre-wrap text-ui text-text">{d.text || 'Текст не задан.'}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-meta">
                    <dt className="text-text-muted">ревизия</dt><dd>{d.revision}</dd>
                    <dt className="text-text-muted">внешний ключ</dt><dd className="font-mono">{d.external_key ?? '—'}</dd>
                    {Object.entries(d.attributes).map(([k, v]) => (<Fragment key={k}><dt className="text-text-muted">{k}</dt><dd>{String(v)}</dd></Fragment>))}
                  </dl>
                  {d.exemption_reason && <p className="text-meta text-text-muted">Исключение: {d.exemption_reason}</p>}
                </div>
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                  <h3 className="text-ui font-semibold">Связи</h3>
                  <Loaded state={relations} retry={relations.reload}>
                    {(all) => {
                      const mine = all.filter((r) => r.source === selected || r.target === selected);
                      return mine.length === 0 ? <p className="text-ui text-text-muted">Связей нет.</p> : (
                        <ul className="flex flex-col gap-1 text-ui">
                          {mine.map((r) => <li key={r.uid} className="font-mono text-meta">{r.source} —{r.type}→ {r.target}</li>)}
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
      )}
    </div>
  );
}
