import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge } from '@/shared/ui';
import { Loaded, Section } from './common';

export function OverviewScreen({ projectKey, onOpenSection }: { projectKey: string; onOpenSection: (s: string, filter?: { type?: string }) => void }) {
  const status = useAsync(`status:${projectKey}`, () => pthApi.status(projectKey));
  const readiness = useAsync(`readiness:${projectKey}`, () => pthApi.readiness(projectKey));
  return (
    <div className="flex flex-col gap-6">
      <Section title="Состояние проекта" hint={`Проект ${projectKey}. Цифры считаются по данным PTH, без оценок.`}>
        <Loaded state={status} retry={status.reload}>
          {(s) => (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(s.artifacts).map(([type, n]) => (
                <button key={type} type="button" onClick={() => onOpenSection('registry', { type })} className="rounded-card border border-border bg-surface p-3 text-left">
                  <div className="text-meta text-text-muted">{type}</div>
                  <div className="text-section font-semibold">{n}</div>
                </button>
              ))}
              <button type="button" onClick={() => onOpenSection('lost')} className="rounded-card border border-border bg-surface p-3 text-left">
                <div className="text-meta text-text-muted">Потерянные</div>
                <div className="text-section font-semibold">{s.lost}</div>
              </button>
              <button type="button" onClick={() => onOpenSection('import')} className="rounded-card border border-border bg-surface p-3 text-left">
                <div className="text-meta text-text-muted">Черновики</div>
                <div className="text-section font-semibold">{s.draft_changesets}</div>
              </button>
              <div className="rounded-card border border-border bg-surface p-3">
                <div className="text-meta text-text-muted">Связей</div>
                <div className="text-section font-semibold">{s.relations}</div>
              </div>
            </div>
          )}
        </Loaded>
      </Section>
      <Section title="Готовность" hint="Вердикт по проверкам. Без тестов и свидетельств проект не может быть готов.">
        <Loaded state={readiness} retry={readiness.reload}>
          {(r) => (
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={r.verdict === 'ready' ? 'готов' : r.verdict === 'not_ready' ? 'не готов' : 'недостаточно данных'} tone={r.verdict === 'ready' ? 'success' : 'warning'} />
              <span className="text-ui text-text">Блокирующих элементов: {r.blocking.length} из {r.total}</span>
              <button type="button" className="text-ui underline" onClick={() => onOpenSection('verify')}>открыть проверку</button>
            </div>
          )}
        </Loaded>
      </Section>
    </div>
  );
}
