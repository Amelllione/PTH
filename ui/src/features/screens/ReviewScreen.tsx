import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, Pager } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText } from './common';
import type { ReviewFinding } from '@/entities/pth/types';

const SEVERITIES = ['all', 'error', 'warning', 'info'] as const;
const STATE_LABEL: Record<string, string> = {
  open: 'открыто', resolved: 'принято', dismissed: 'снято', reopened: 'открыто снова',
};

function DecisionCell({ finding, projectKey, onDone }: { finding: ReviewFinding & { state: string }; projectKey: string; onDone: () => void }) {
  const [mode, setMode] = useState<'resolved' | 'dismissed' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decided = finding.state === 'resolved' || finding.state === 'dismissed';
  if (decided) return <span className="text-meta text-text-muted">{STATE_LABEL[finding.state]}</span>;

  const submit = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await pthApi.decideReview(projectKey, { rule: finding.rule, display_id: finding.display_id, state: mode, reason: reason.trim() });
      setMode(null);
      setReason('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить решение');
    } finally {
      setBusy(false);
    }
  };

  if (!mode) {
    return (
      <div className="flex items-center gap-3 text-meta">
        <button type="button" className="font-medium text-accent-text underline underline-offset-2" onClick={() => setMode('resolved')}>Принять</button>
        <button type="button" className="text-text-muted underline underline-offset-2" onClick={() => setMode('dismissed')}>Снять</button>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="text-meta text-text-muted" htmlFor={`reason-${finding.rule}-${finding.display_id}`}>
        {mode === 'resolved' ? 'Почему принимаем' : 'Почему снимаем'}
      </label>
      <input
        id={`reason-${finding.rule}-${finding.display_id}`}
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        className="h-8 w-full rounded-control border border-control-border bg-surface px-2 text-ui text-text"
      />
      <div className="flex items-center gap-3 text-meta">
        <button type="submit" disabled={!reason.trim() || busy} className="font-medium text-accent-text underline underline-offset-2 disabled:opacity-50">Сохранить</button>
        <button type="button" className="text-text-muted underline underline-offset-2" onClick={() => { setMode(null); setReason(''); }}>Отмена</button>
      </div>
      {error && <span role="alert" className="text-meta text-danger-text">{error}</span>}
    </form>
  );
}

export function ReviewScreen({ projectKey }: { projectKey: string }) {
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('all');
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const review = useAsync(`review:${projectKey}:${version}:${severity}:${page}:${pageSize}`, () =>
    pthApi.reviewPage(projectKey, page * pageSize, pageSize, severity === 'all' ? undefined : severity));
  return (
    <Section title="Замечания" hint="Правила качества на сервере. Принять или снять можно с причиной; новая ревизия элемента открывает замечание снова.">
      <div role="group" aria-label="Уровень" className="flex flex-wrap gap-2">
        {SEVERITIES.map((s) => (
          <Button key={s} size="sm" variant={s === severity ? 'primary' : 'secondary'} aria-pressed={s === severity} onClick={() => { setSeverity(s); setPage(0); }}>
            {s === 'all' ? 'Все' : s === 'error' ? 'Ошибки' : s === 'warning' ? 'Предупреждения' : 'Подсказки'}
          </Button>
        ))}
      </div>
      <Loaded state={review} retry={review.reload} empty={{ title: 'Замечаний нет', isEmpty: (d) => d.findings.length === 0 }}>
        {(d) => {
          const rows = d.findings;
          return (
            <>
              <p className="text-ui text-text-muted">ошибок: {d.counts.error ?? 0} · предупреждений: {d.counts.warning ?? 0} · подсказок: {d.counts.info ?? 0}</p>
              <DataTable
                caption="Замечания по правилам"
                columns="7.5rem 7rem 11rem minmax(0,1fr) minmax(16rem,20rem)"
                footer={<Pager page={page} pageSize={pageSize} total={d.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} label="Страницы замечаний" />}
                headers={['Уровень', 'ID', 'Правило', 'Пояснение', 'Решение']}
                rows={rows.map((f) => [
                  <StatusText key="s" label={f.severity === 'error' ? 'ошибка' : f.severity === 'warning' ? 'предупреждение' : 'подсказка'} tone={f.severity === 'error' ? 'bad' : f.severity === 'warning' ? 'warn' : 'info'} />,
                  <span key="i" className="font-mono text-meta">{f.display_id}</span>,
                  <span key="r" className="font-mono text-meta">{f.rule}</span>,
                  <span key="m">{f.message}{f.decision?.reason ? <span className="block text-meta text-text-muted">причина: {f.decision.reason} ({f.decision.actor})</span> : null}</span>,
                  <DecisionCell key="d" finding={f} projectKey={projectKey} onDone={() => setVersion((v) => v + 1)} />,
                ])}
              />
            </>
          );
        }}
      </Loaded>
    </Section>
  );
}
