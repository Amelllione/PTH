import { useState, type FormEvent } from 'react';
import { Badge as CommitBadge } from '@/shared/ui';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';

export function CodeScreen({ projectKey }: { projectKey: string }) {
  const repo = useAsync(`repo:${projectKey}`, () => pthApi.repo(projectKey));
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE = 20;
  const commits = useAsync(`commits:${projectKey}:${version}:${page}`, () =>
    pthApi.commitsPage(projectKey, page * PAGE, PAGE));
  const [openSha, setOpenSha] = useState<string | null>(null);
  const commit = useAsync(openSha ? `commit:${projectKey}:${openSha}` : null, () => pthApi.commit(projectKey, openSha ?? ''));
  const [sha, setSha] = useState('');
  const [title, setTitle] = useState('');
  const [implementsRaw, setImplementsRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const register = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ids = implementsRaw.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      await pthApi.registerCommit(projectKey, { sha: sha.trim(), title: title.trim(), implements: ids });
      setSha(''); setTitle(''); setImplementsRaw('');
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрировать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Репозиторий" hint="Только чтение. Коммит, которого нет в подключённом репозитории, не подтверждается.">
        <Loaded state={repo} retry={repo.reload}>
          {(r) => !r.connected ? (
            <p className="text-ui text-text">Не подключён. Результаты CI остаются «ожидают проверки» и не засчитываются.</p>
          ) : (
            <p className="text-ui text-text">
              <span className="font-mono text-meta">{r.path}</span>{' · '}
              {r.available ? <>HEAD <span className="font-mono text-meta">{r.head?.slice(0, 12) ?? '—'}</span></> : <span className="text-danger-text">недоступен: {r.note}</span>}
            </p>
          )}
        </Loaded>
      </Section>

      <Section title="Регистрация коммита" hint="Связь «коммит реализует требование» — утверждение автора, не доказательство реализации.">
        <form onSubmit={register} className="flex flex-col gap-3" aria-label="Регистрация коммита">
          <div className="flex flex-wrap items-end gap-2">
            <TextField label="SHA" hint="7–40 hex" value={sha} onChange={(e) => setSha(e.target.value.toLowerCase())} className="w-44" />
            <TextField label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} className="w-80" />
          </div>
          <TextField label="Реализуемые требования" hint="через пробел или запятую, например PTH-FR-012 PTH-FR-015" value={implementsRaw} onChange={(e) => setImplementsRaw(e.target.value)} className="w-full max-w-xl" />
          {error && <InlineAlert tone="danger" message={error} />}
          <div>
            <Button type="submit" variant="primary" disabled={!/^[0-9a-f]{7,40}$/.test(sha) || !title.trim() || !implementsRaw.trim() || busy} loading={busy}>
              Зарегистрировать
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Коммиты">
        <Loaded state={commits} retry={commits.reload} empty={{ title: 'Коммитов нет', description: 'Зарегистрируйте коммит выше.', isEmpty: (d) => d.items.length === 0 }}>
          {({ items: rows, total }) => (
            <>
            <DataTable caption="Коммиты" columns="7rem minmax(0,1fr) minmax(0,1fr) 11rem"
              footer={<Pager page={page} pageSize={PAGE} total={total} onPage={setPage} label="Страницы коммитов" />} headers={['SHA', 'Заголовок', 'Реализует', 'Когда']}
              rows={rows.map((c) => [
                <button key="s" type="button" title={c.sha ?? ''} className="font-mono text-meta underline" onClick={() => setOpenSha(c.sha)}>{c.sha?.slice(0, 10)}</button>,
                c.title,
                c.implements.join(', ') || '—',
                new Date(c.created_at).toLocaleString('ru-RU'),
              ])} />
            </>
          )}
        </Loaded>
        {openSha && (
          <Loaded state={commit} retry={commit.reload}>
            {(c) => (
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-ui">
                <p className="font-semibold">{c.title}</p>
                <p className="font-mono text-meta">{c.sha} · {c.display_id}</p>
                <p>Реализует: {c.implements.join(', ') || '—'}</p>
                <p>Свидетельства: {c.evidence.length === 0 ? 'нет' : c.evidence.map((e) => `${e.test ?? '—'}: ${e.result}`).join('; ')}</p>
                <CommitBadge label={c.reachability} tone="warning" />
              </div>
            )}
          </Loaded>
        )}
      </Section>
    </div>
  );
}
