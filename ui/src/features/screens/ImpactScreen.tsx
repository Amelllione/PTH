import { useState, type FormEvent } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';

export function ImpactScreen({ projectKey }: { projectKey: string }) {
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<{ focus: string; depth: number } | null>(null);
  const impact = useAsync(request ? `impact:${projectKey}:${request.focus}:${request.depth}` : null, () =>
    pthApi.impact(projectKey, request?.focus ?? '', request?.depth ?? 1));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = draft.trim().toUpperCase();
    if (id) setRequest({ focus: id, depth: 2 });
  };
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
                  <span key="i" className="font-mono text-meta">{i.display_id}</span>,
                  <Badge key="t" label={i.type} />,
                  String(i.depth),
                  <span key="p" className="font-mono text-meta">{i.path.join(' → ')}</span>,
                  <span key="r" className="font-mono text-meta">{i.rule_id}</span>,
                  <Badge key="c" label={i.certainty === 'explicit' ? 'явно' : 'кандидат'} tone={i.certainty === 'explicit' ? 'warning' : 'neutral'} />,
                  i.action,
                ])}
              />
              <p className="text-meta text-text-muted">{d.note}</p>
            </>
          )}
        </Loaded>
      )}
    </Section>
  );
}
