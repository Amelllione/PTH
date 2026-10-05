import { useState, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText } from './common';

const TEST_STATE: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  passed_current: { label: 'прошёл на HEAD', tone: 'ok' },
  passed_old_commit: { label: 'прошёл на старом коммите', tone: 'warn' },
  failed: { label: 'упал', tone: 'bad' },
  inconclusive: { label: 'не определён', tone: 'warn' },
  pending_verification: { label: 'ожидает проверки', tone: 'warn' },
  not_run: { label: 'не запускался', tone: 'neutral' },
};

const COMPLIANCE_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  verified: 'ok', failed: 'bad', stale: 'warn', not_verified: 'warn', no_test: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  verified: 'проверено', failed: 'упало', stale: 'устарело', not_verified: 'не проверено', no_test: 'нет теста', excluded: 'исключено',
};

export function VerificationScreen({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const compliance = useAsync(`compliance:${projectKey}:${version}`, () => pthApi.compliance(projectKey));
  const [evPage, setEvPage] = useState(0);
  const EV = 20;
  const evidence = useAsync(`evidence:${projectKey}:${version}:${evPage}`, () => pthApi.evidencePage(projectKey, evPage * EV, EV));
  const psi = useAsync(`psi:${projectKey}:${version}`, () => pthApi.psi(projectKey));
  const [test, setTest] = useState('');
  const [compPage, setCompPage] = useState(0);
  const COMP = 20;
  const [result, setResult] = useState<'pass' | 'fail' | 'blocked' | 'inconclusive'>('pass');
  const [commit, setCommit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const record = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pthApi.recordEvidence(projectKey, { test: test.trim().toUpperCase(), result, commit_sha: commit.trim() || undefined });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось записать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Соответствие" hint="Требование проверено, только если все его тесты прошли и свидетельство новее последней правки требования.">
        <Loaded state={compliance} retry={compliance.reload}>
          {(c) => (
            <>
              <div className="flex flex-wrap gap-2">
                {Object.entries(c.counts).map(([s, n]) => <Badge key={s} label={`${STATUS_LABEL[s] ?? s}: ${n}`} tone={s === 'verified' ? 'success' : s === 'failed' ? 'danger' : 'neutral'} />)}
              </div>
              {(() => {
                const visible = c.items.filter((i) => i.status !== 'excluded');
                const pageItems = visible.slice(compPage * COMP, (compPage + 1) * COMP);
                return (
                  <DataTable
                    caption="Соответствие требований"
                    columns="9rem 9rem minmax(0,1fr)"
                    footer={<Pager page={compPage} pageSize={COMP} total={visible.length} onPage={setCompPage} label="Страницы соответствия" />}
                    headers={['Требование', 'Статус', 'Тесты']}
                    rows={pageItems.map((i) => [
                      <span key="i" className="font-mono text-meta">{i.display_id}</span>,
                      <StatusText key="st" label={STATUS_LABEL[i.status] ?? i.status} tone={COMPLIANCE_TONE[i.status] ?? 'neutral'} />,
                      i.tests.map((t) => `${t.display_id} (${STATUS_LABEL[t.status] ?? t.status})`).join(', ') || '—',
                    ])}
                  />
                );
              })()}
            </>
          )}
        </Loaded>
      </Section>

      <Section title="Тесты" hint="Состояние тестов относительно текущего коммита. Тесты запускаются хуком после каждого коммита.">
        <TestsPanel projectKey={projectKey} />
      </Section>

      <Section title="Записать свидетельство" hint="Записывайте только реально полученный результат запуска теста. Запись неизменяема.">
        <form onSubmit={record} className="flex flex-wrap items-end gap-2" aria-label="Свидетельство">
          <TextField label="Тест" hint="например PTH-TEST-001" value={test} onChange={(e) => setTest(e.target.value)} className="w-56" />
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Результат
            <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="pass">прошёл</option><option value="fail">упал</option><option value="blocked">заблокирован</option><option value="inconclusive">неясно</option>
            </select>
          </label>
          <TextField label="Коммит (необязательно)" value={commit} onChange={(e) => setCommit(e.target.value)} className="w-44" />
          <Button type="submit" variant="primary" disabled={!test.trim() || busy} loading={busy}>Записать</Button>
        </form>
        {error && <InlineAlert tone="danger" message={error} />}
        <Loaded state={evidence} retry={evidence.reload} empty={{ title: 'Свидетельств нет', isEmpty: (d) => d.items.length === 0 }}>
          {({ items: rows, total }) => (
            <>
            <DataTable caption="Свидетельства" columns="11rem minmax(0,1fr) 7rem 9rem" headers={['Когда', 'Тест', 'Результат', 'Коммит']}
              footer={<Pager page={evPage} pageSize={EV} total={total} onPage={setEvPage} label="Страницы свидетельств" />}
              rows={rows.map((r) => [new Date(r.created_at).toLocaleString('ru-RU'), r.test ?? '—', r.result, r.commit_sha?.slice(0, 10) ?? '—'])} />
            </>
          )}
        </Loaded>
      </Section>

      <Section title="Черновик ПСИ" hint="Сгенерировано из требований и свидетельств. Не утверждённый документ.">
        <Loaded state={psi} retry={psi.reload}>
          {(text) => <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-4 font-mono text-meta text-text">{text}</pre>}
        </Loaded>
      </Section>
    </div>
  );
}

function TestsPanel({ projectKey }: { projectKey: string }) {
  const tests = useAsync(`tests-status:${projectKey}`, () => pthApi.testsStatus(projectKey));
  return (
    <Loaded state={tests} retry={tests.reload} empty={{ title: 'Тестов нет', description: 'Заведите TEST-элемент и свяжите его с требованием.', isEmpty: (d) => d.tests.length === 0 }}>
      {(d) => (
        <>
          <p className="text-ui text-text-muted">
            HEAD: <span className="font-mono">{d.head ? d.head.slice(0, 10) : '—'}</span>
            {Object.entries(d.counts).map(([s, n]) => ` · ${TEST_STATE[s]?.label ?? s}: ${n}`).join('')}
          </p>
          <DataTable
            caption="Состояние тестов"
            columns="8rem minmax(0,1fr) 12rem 9rem 11rem"
            headers={['Тест', 'Что проверяет', 'Состояние', 'Коммит', 'Требования']}
            rows={d.tests.map((t) => [
              <span key="t" className="font-mono text-meta">{t.test}</span>,
              t.title,
              <StatusText key="s" label={TEST_STATE[t.state]?.label ?? t.state} tone={TEST_STATE[t.state]?.tone ?? 'neutral'} />,
              <span key="c" className="font-mono text-meta" title={t.commit ?? ''}>{t.commit ? t.commit.slice(0, 10) : '—'}</span>,
              <span key="r" className="font-mono text-meta">{t.requirements.join(', ') || '—'}</span>,
            ])}
          />
          {d.requirements_without_test.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-ui font-semibold text-text">Требования без теста: {d.requirements_without_test.length}</h3>
              <p className="font-mono text-meta text-text-muted break-words">{d.requirements_without_test.join(', ')}</p>
            </div>
          )}
        </>
      )}
    </Loaded>
  );
}
