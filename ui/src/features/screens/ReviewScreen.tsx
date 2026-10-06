import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, Pager } from '@/shared/ui';
import { DataTable, Loaded, Section, StatusText } from './common';
import type { ReviewFinding, ReviewRuleText } from '@/entities/pth/types';
import { CopyId } from '@/shared/ui/CopyId';

const SEVERITIES = ['all', 'error', 'warning', 'info'] as const;
const SEVERITY_LABEL: Record<ReviewRuleText['severity'], string> = { error: 'Ошибка', warning: 'Предупреждение', info: 'Подсказка' };
const SEVERITY_MEANING: Record<ReviewRuleText['severity'], string> = {
  error: 'нарушение правила, которое стоит исправить',
  warning: 'стоит проверить, не всегда ошибка',
  info: 'улучшение формулировки',
};
const STATE_LABEL: Record<string, string> = {
  open: 'открыто', resolved: 'принято', dismissed: 'снято', reopened: 'открыто снова',
};

function DecisionCell({ finding, projectKey, onDone }: { finding: ReviewFinding & { state: string }; projectKey: string; onDone: () => void }) {
  // Принять и снять по смыслу одно и то же: замечание закрыто с причиной. Остаётся одно действие.
  const [mode, setMode] = useState<'resolved' | null>(null);
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
        <button type="button" className="font-medium text-accent-text underline underline-offset-2" onClick={() => setMode('resolved')}>Принять с причиной</button>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="text-meta text-text-muted" htmlFor={`reason-${finding.rule}-${finding.display_id}`}>
        Почему принимаем
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
          const showLevel = severity === 'all';
          return (
            <>
              <p className="text-ui text-text-muted">ошибок: {d.counts.error ?? 0} · предупреждений: {d.counts.warning ?? 0} · подсказок: {d.counts.info ?? 0}</p>
              <details className="rounded-card border border-border bg-surface p-4 text-ui">
                <summary className="cursor-pointer font-semibold text-text">Что проверяет каждое правило</summary>
                <div className="mt-3 flex flex-col gap-4">
                  {(['error', 'warning', 'info'] as const).map((sev) => (
                    <section key={sev} aria-label={SEVERITY_LABEL[sev]} className="flex flex-col gap-2">
                      <h3 className="text-meta font-semibold text-text-muted">{SEVERITY_LABEL[sev]}: {SEVERITY_MEANING[sev]}</h3>
                      <ul className="flex flex-col gap-2">
                        {Object.entries(d.rules).filter(([, r]) => r.severity === sev).map(([code, r]) => (
                          <li key={code} className="flex flex-col gap-0.5">
                            <span className="text-text">{r.title} <span className="font-mono text-meta text-text-muted">{code}</span></span>
                            <span className="text-text-muted">{r.description}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </details>
              <DataTable
                caption="Замечания по правилам"
                columns={showLevel ? '7.5rem 7rem 11rem minmax(0,1fr) minmax(16rem,20rem)' : '7rem 11rem minmax(0,1fr) minmax(16rem,20rem)'}
                footer={<Pager page={page} pageSize={pageSize} total={d.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} label="Страницы замечаний" />}
                headers={showLevel ? ['Уровень', 'ID', 'Правило', 'Пояснение', 'Решение'] : ['ID', 'Правило', 'Пояснение', 'Решение']}
                rows={rows.map((f) => [
                  ...(showLevel ? [<StatusText key="s" label={f.severity === 'error' ? 'ошибка' : f.severity === 'warning' ? 'предупреждение' : 'подсказка'} tone={f.severity === 'error' ? 'bad' : f.severity === 'warning' ? 'warn' : 'info'} />] : []),
                  <CopyId key="i" value={f.display_id} className="font-mono text-meta">{f.display_id}</CopyId>,
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
