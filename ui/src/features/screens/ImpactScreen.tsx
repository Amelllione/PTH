import { useState, type FormEvent } from 'react';
import { ArtifactCard } from './ArtifactCard';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';
import { CopyId } from '@/shared/ui/CopyId';
import { ImpactRulesPanel } from './ImpactRulesPanel';

export function ImpactScreen({ projectKey }: { projectKey: string }) {
  const [draft, setDraft] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [request, setRequest] = useState<{ focus: string; depth: number } | null>(null);
  // rulesVersion меняется при правке своих правил: результат пересчитывается сразу.
  const [rulesVersion, setRulesVersion] = useState(0);
  const impact = useAsync(request ? `impact:${projectKey}:${request.focus}:${request.depth}:${rulesVersion}` : null, () =>
    pthApi.impact(projectKey, request?.focus ?? '', request?.depth ?? 1));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = draft.trim().toUpperCase();
    if (id) setRequest({ focus: id, depth: 2 });
  };
  // Карточка открывается на весь экран; результат расчёта и введённый элемент сохраняются при возврате.
  if (openId) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>Назад к результату</Button>
        </div>
        <ArtifactCard key={openId} projectKey={projectKey} displayId={openId} onOpen={setOpenId} />
      </div>
    );
  }
  return (
    <Section title="Влияние изменения" hint="Что перепроверить, если поменять элемент. Явные пути по правилам каталога связей; кандидаты не являются нарушениями.">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <TextField label="Изменяемый элемент" hint="например PTH-US-004" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-64" />
        <Button type="submit" variant="secondary">Посчитать</Button>
      </form>
      {!request && <p className="text-ui text-text-muted">Укажите элемент, чтобы увидеть затронутые.</p>}
      {request && (
        <Loaded state={impact} retry={impact.reload} empty={{ title: 'Влияния нет', description: 'По связям ничего не затрагивается.', isEmpty: (d) => d.items.length === 0 }}>
          {(d) => (
            <>
              {d.truncated && <InlineAlert tone="warning" message="Список обрезан по лимиту. Уменьшите глубину." />}
              <DataTable
                caption="Затронутые элементы"
                headers={['Элемент', 'Тип', 'Глубина', 'Путь', 'Правило', 'Уверенность', 'Действие']}
                rows={d.items.map((i) => [
                  <CopyId key="i" value={i.display_id}><button type="button" aria-pressed={openId === i.display_id} onClick={() => setOpenId(i.display_id)} className="font-mono text-meta text-accent-text underline underline-offset-2">{i.display_id}</button></CopyId>,
                  <Badge key="t" label={i.type} />,
                  String(i.depth),
                  <span key="p" className="font-mono text-meta">{i.path.join(' → ')}</span>,
                  <span key="r" className="font-mono text-meta" title={(i.rule_ids ?? [i.rule_id]).join(', ')}>{(i.rule_ids ?? [i.rule_id]).join(', ')}</span>,
                  <Badge key="c" label={i.certainty === 'explicit' ? 'явно' : 'кандидат'} tone={i.certainty === 'explicit' ? 'warning' : 'neutral'} />,
                  i.action,
                ])}
              />
              <p className="text-meta text-text-muted">{d.note}</p>
              {Object.keys(d.rules).length > 0 && (
                <section aria-label="Сработавшие правила" className="flex flex-col gap-1.5 text-meta">
                  <h3 className="text-ui font-semibold text-text">Сработавшие правила</h3>
                  <ul className="flex flex-col gap-1.5">
                    {Object.entries(d.rules).map(([code, r]) => (
                      <li key={code}><span className="text-text">{r.title}</span> <span className="font-mono text-text-muted">{code}</span>. <span className="text-text-muted">{r.description}</span></li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </Loaded>
      )}
      <ImpactRulesPanel projectKey={projectKey} onChanged={() => setRulesVersion((v) => v + 1)} />
    </Section>
  );
}
