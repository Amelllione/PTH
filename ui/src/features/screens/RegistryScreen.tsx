import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';
import { ArtifactCard } from './ArtifactCard';

export function RegistryScreen({ projectKey, initialType = '' }: { projectKey: string; initialType?: string }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState(initialType);
  const [submitted, setSubmitted] = useState({ q: '', type: initialType });
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

      {selected && <ArtifactCard projectKey={projectKey} displayId={selected} />}
    </div>
  );
}
