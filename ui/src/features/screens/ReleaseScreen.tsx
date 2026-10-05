import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';
import { useEffect } from 'react';

export function ReleaseScreen({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const readiness = useAsync(`readiness:${projectKey}:${version}`, () => pthApi.readiness(projectKey));
  const baselines = useAsync(`baselines:${projectKey}:${version}`, () => pthApi.baselines(projectKey));
  const [selected, setSelected] = useState<string | null>(null);
  const [blkPage, setBlkPage] = useState(0);
  const BLK = 20;
  const detail = useAsync(selected ? `bl:${projectKey}:${selected}` : null, () => pthApi.baselineDetail(projectKey, selected ?? ''));
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const comparison = useAsync(
    compareA && compareB && compareA !== compareB ? `cmp:${projectKey}:${compareA}:${compareB}` : null,
    () => pthApi.compareBaselines(projectKey, compareA, compareB),
  );
  useEffect(() => { setCompareA(''); setCompareB(''); }, [projectKey]);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      await pthApi.createBaseline(projectKey, name.trim());
      setName(''); setConfirm(false); setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать снимок');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Готовность" hint="Вердикт — это данные, а не решение о релизе. Принимает релиз пользователь.">
        <Loaded state={readiness} retry={readiness.reload}>
          {(r) => (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={r.verdict === 'ready' ? 'данные готовы' : r.verdict === 'not_ready' ? 'не готов' : 'недостаточно данных'} tone={r.verdict === 'ready' ? 'success' : 'warning'} />
                <span className="text-ui">проверяемых: {r.total}, блокирующих: {r.blocking.length}</span>
              </div>
              {r.blocking.length > 0 && (
                <DataTable caption="Блокирующие элементы" columns="10rem minmax(0,1fr)" headers={['Элемент', 'Статус']}
                  footer={<Pager page={blkPage} pageSize={BLK} total={r.blocking.length} onPage={setBlkPage} label="Страницы блокирующих элементов" />}
                  rows={r.blocking.slice(blkPage * BLK, (blkPage + 1) * BLK).map((b) => [<span key="b" className="font-mono text-meta">{b.display_id}</span>, b.status])} />
              )}
            </>
          )}
        </Loaded>
      </Section>

      <Section title="Сравнение снимков" hint="Что изменилось между двумя снимками: элементы, ревизии и связи.">
        <Loaded state={baselines} retry={baselines.reload} empty={{ title: 'Снимков для сравнения нет', description: 'Нужно хотя бы два снимка.', isEmpty: (d) => d.length < 2 }}>
          {(rows) => (
            <>
              <div className="flex flex-wrap items-end gap-2">
                {(['A', 'B'] as const).map((side) => (
                  <label key={side} className="flex flex-col gap-1 text-meta text-text-muted">
                    Снимок {side}
                    <select
                      aria-label={`Снимок ${side}`}
                      value={side === 'A' ? compareA : compareB}
                      onChange={(e) => (side === 'A' ? setCompareA(e.target.value) : setCompareB(e.target.value))}
                      className="h-9 min-w-56 rounded-control border border-control-border bg-surface px-2 text-ui text-text"
                    >
                      <option value="">выберите</option>
                      {rows.map((b) => <option key={b.uid} value={b.uid}>{b.name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {compareA && compareB && compareA === compareB && <InlineAlert tone="info" message="Выбраны одинаковые снимки." />}
              {compareA && compareB && compareA !== compareB && (
                <Loaded state={comparison} retry={comparison.reload}>
                  {(c) => (
                    <div className="grid gap-2 rounded-card border border-border bg-surface p-4 text-ui sm:grid-cols-2">
                      <p>Добавлено элементов: {c.added.length} {c.added.length > 0 && <span className="font-mono text-meta">{c.added.slice(0, 20).join(', ')}</span>}</p>
                      <p>Удалено элементов: {c.removed.length} {c.removed.length > 0 && <span className="font-mono text-meta">{c.removed.slice(0, 20).join(', ')}</span>}</p>
                      <p>Изменены ревизии: {c.changed.length} {c.changed.length > 0 && <span className="font-mono text-meta">{c.changed.slice(0, 20).join(', ')}</span>}</p>
                      <p>Связей добавлено: {c.relations_added.length}, удалено: {c.relations_removed.length}</p>
                    </div>
                  )}
                </Loaded>
              )}
            </>
          )}
        </Loaded>
      </Section>

      <Section title="Снимки" hint="Снимок фиксирует головные ревизии и связи. Состав виден ниже; восстановление из снимка пока не реализовано.">
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Название снимка" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
          {!confirm ? (
            <Button variant="secondary" disabled={!name.trim()} onClick={() => setConfirm(true)}>Зафиксировать…</Button>
          ) : (
            <>
              <span className="text-ui text-text">Зафиксировать снимок «{name.trim()}»?</span>
              <Button variant="primary" onClick={() => void create()}>Да, зафиксировать</Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Отмена</Button>
            </>
          )}
        </div>
        {error && <InlineAlert tone="danger" message={error} />}
        <Loaded state={baselines} retry={baselines.reload} empty={{ title: 'Снимков нет', isEmpty: (d) => d.length === 0 }}>
          {(rows) => (
            <DataTable caption="Снимки" headers={['Название', 'Когда', 'Элементов', '']}
              rows={rows.map((b) => [b.name, new Date(b.created_at).toLocaleString('ru-RU'), String(b.artifacts),
                <button key={b.uid} type="button" className="underline" onClick={() => setSelected(b.uid)}>состав</button>])} />
          )}
        </Loaded>
        {selected && (
          <Loaded state={detail} retry={detail.reload}>
            {(d) => (
              <div className="rounded-card border border-border bg-surface p-4 text-meta">
                <p className="text-ui font-semibold">{d.name}: элементов {Object.keys(d.artifacts).length}, связей {d.relations.length}</p>
                <p className="font-mono">{Object.entries(d.artifacts).slice(0, 40).map(([k, v]) => `${k}@${v}`).join('  ')}</p>
              </div>
            )}
          </Loaded>
        )}
      </Section>
    </div>
  );
}
