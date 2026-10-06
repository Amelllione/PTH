import { useState, type FormEvent } from 'react';
import { pthApi, ApiError } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, Tabs, TextField } from '@/shared/ui';
import type { ImpactRuleRow } from '@/entities/pth/types';
import { DataTable, Loaded, Section } from './common';

const RELATIONS = [
  ['refines', 'уточняет (refines)'],
  ['motivates', 'опирается на ADR (motivates)'],
  ['implements', 'реализует коммит (implements)'],
  ['verifies', 'проверяет тест (verifies)'],
  ['illustrates', 'схема показывает процесс (illustrates)'],
] as const;
const DIRECTIONS = [
  ['out', 'элемент ссылается'],
  ['in', 'на элемент ссылаются'],
] as const;
const NEIGHBORS = ['US', 'FR', 'NFR', 'AC', 'ADR', 'TEST', 'COMMIT', 'DIAGRAM'] as const;
const CERTAINTY = [
  ['explicit', 'явно'],
  ['candidate', 'кандидат'],
] as const;

const RELATION_LABEL: Record<string, string> = Object.fromEntries(RELATIONS);
const DIRECTION_LABEL: Record<string, string> = Object.fromEntries(DIRECTIONS);

const selectClass = 'h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text';

/** Список с множественным выбором: каждый клик по строке добавляет или снимает тип, выбранные отмечены галочкой.
 *  Пустой выбор означает «любой допустимый по связи». */
function TypeMultiSelect({ label, hint, value, onChange }: { label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (type: string) => onChange(value.includes(type) ? value.filter((x) => x !== type) : [...value, type]);
  return (
    <div className="flex flex-col gap-1.5 text-meta text-text-muted">
      <span id={`${label}-label`} className="text-ui font-medium text-text">{label}</span>
      <div role="listbox" aria-multiselectable="true" aria-labelledby={`${label}-label`} aria-describedby={`${label}-hint`}
        className="grid grid-cols-2 gap-0.5 rounded-control border border-control-border bg-surface p-1">
        {NEIGHBORS.map((type) => {
          const on = value.includes(type);
          return (
            <div
              key={type}
              role="option"
              aria-selected={on}
              tabIndex={0}
              onClick={() => toggle(type)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(type); } }}
              className={`flex cursor-pointer items-center gap-2 rounded-control px-2 py-1 text-ui focus-visible:outline-2 focus-visible:outline-accent ${on ? 'bg-surface-muted text-text' : 'text-text-muted hover:bg-surface-muted/60'}`}
            >
              <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded-sm border ${on ? 'border-accent-text bg-accent-soft text-accent-text' : 'border-control-border'}`}>
                {on && '✓'}
              </span>
              {type}
            </div>
          );
        })}
      </div>
      <span id={`${label}-hint`}>{hint}</span>
    </div>
  );
}

/** Одна таблица для встроенных и своих правил: название с ID и описанием, связь, стороны, уверенность, действие. */
function RulesTable({ caption, rules, empty, actions }: {
  caption: string;
  rules: ImpactRuleRow[];
  empty: string;
  actions?: (rule: ImpactRuleRow) => React.ReactNode;
}) {
  return (
    <DataTable
      caption={caption}
      headers={['Название', 'Связь', 'Что изменилось → что проверяем', 'Уверенность', 'Что проверить', 'Состояние']}
      columns="minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.1fr) minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,9rem)"
      rows={rules.map((r) => [
        <span key="c" className="flex flex-col gap-0.5">
          <span className="text-ui font-medium">{r.title}</span>
          <span className="font-mono text-meta text-text-muted">{r.code}</span>
          {r.description && <span className="text-meta text-text-muted">{r.description}</span>}
        </span>,
        <span key="r" className="text-meta">{RELATION_LABEL[r.relation_type]}, {DIRECTION_LABEL[r.direction]}</span>,
        <span key="n" className="flex flex-wrap items-center gap-1.5 text-meta">
          {r.focus_types.map((x) => <Badge key={`f-${x}`} label={x} />)}
          <span className="text-text-muted">→</span>
          {r.neighbor_types.map((x) => <Badge key={`n-${x}`} label={x} />)}
        </span>,
        <Badge key="k" label={r.certainty === 'explicit' ? 'явно' : 'кандидат'} tone={r.certainty === 'explicit' ? 'warning' : 'neutral'} />,
        <span key="a" className="text-ui">{r.action}</span>,
        <span key="s" className="flex flex-col items-start gap-2">
          {actions ? (
            <>
              <span className={r.enabled ? 'text-meta text-success-text' : 'text-meta text-text-muted'}>{r.enabled ? 'включено' : 'выключено'}</span>
              {actions(r)}
            </>
          ) : (
            <span className="text-meta text-text-muted">встроенное</span>
          )}
        </span>,
      ])}
      footer={rules.length === 0 && empty ? <span className="text-meta text-text-muted">{empty}</span> : undefined}
    />
  );
}

/** Встроенные правила (только чтение) и свои правила проекта: включить, выключить, удалить, добавить. */
export function ImpactRulesPanel({ projectKey, onChanged }: { projectKey: string; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<'custom' | 'builtin'>('custom');
  const rules = useAsync(`impact-rules:${projectKey}:${version}`, () => pthApi.impactRules(projectKey));
  const [code, setCode] = useState('');
  const [relation, setRelation] = useState<(typeof RELATIONS)[number][0]>('refines');
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number][0]>('out');
  const [focus, setFocus] = useState<string[]>([]);
  const [neighbor, setNeighbor] = useState<string[]>([]);
  const [certainty, setCertainty] = useState<(typeof CERTAINTY)[number][0]>('candidate');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : 'Не удалось сохранить правило');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pthApi.createImpactRule(projectKey, {
        code: code.trim().toUpperCase(), title: title.trim(), description: description.trim(),
        relation_type: relation, direction, focus_types: focus, neighbor_types: neighbor,
        certainty, action: action.trim(),
      });
      setCode('');
      setTitle('');
      setDescription('');
      setFocus([]);
      setNeighbor([]);
      setAction('');
      changed();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (ruleCode: string, enabled: boolean) => {
    setError(null);
    try {
      await pthApi.setImpactRuleEnabled(projectKey, ruleCode, !enabled);
      changed();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (ruleCode: string) => {
    setError(null);
    try {
      await pthApi.deleteImpactRule(projectKey, ruleCode);
      changed();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Section title="Правила влияния" hint="Свои правила добавляются к встроенным и сразу меняют результат расчёта. Выключенное правило не применяется.">
      {error && <InlineAlert tone="danger" message={error} />}
      <Loaded state={rules} retry={rules.reload}>
        {(d) => {
          const builtinRows: ImpactRuleRow[] = d.builtin.map((b) => ({
            ...b, enabled: true,
            relation_type: b.relation_type as ImpactRuleRow['relation_type'],
            direction: b.direction as ImpactRuleRow['direction'],
            certainty: b.certainty as ImpactRuleRow['certainty'],
          }));
          return (
            <>
              <Tabs
                label="Виды правил"
                idPrefix="impact-rules"
                selectedId={tab}
                onChange={(id) => setTab(id as 'custom' | 'builtin')}
                items={[
                  { id: 'custom', label: `Свои (${d.custom.length})` },
                  { id: 'builtin', label: `Встроенные (${d.builtin.length})` },
                ]}
              />
              <div role="tabpanel" id={`impact-rules-panel-${tab}`} aria-labelledby={`impact-rules-tab-${tab}`} className="flex flex-col gap-4">
                {tab === 'custom' ? (
                  <>
                    <RulesTable
                      caption="Свои правила проекта"
                      rules={d.custom}
                      empty="Своих правил пока нет."
                      actions={(r) => (
                        <span className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => toggle(r.code, r.enabled)}>{r.enabled ? 'Выключить' : 'Включить'}</Button>
                          <Button size="sm" variant="secondary" onClick={() => remove(r.code)}>Удалить</Button>
                        </span>
                      )}
                    />
                    <form onSubmit={create} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Новое правило влияния">
                      <h3 className="text-ui font-semibold">Новое правило</h3>
                      <div className="flex flex-wrap items-end gap-3">
                        <TextField label="ID проверки" hint="например CHK-AC-SEC" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
                        <TextField label="Название" hint="как правило будет называться в списке" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="w-96" />
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-meta text-text-muted">
                          Связь
                          <select value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)} className={selectClass}>
                            {RELATIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-meta text-text-muted">
                          Направление
                          <select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} className={selectClass}>
                            {DIRECTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-meta text-text-muted">
                          Уверенность
                          <select value={certainty} onChange={(e) => setCertainty(e.target.value as typeof certainty)} className={selectClass}>
                            {CERTAINTY.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="grid items-start gap-4 sm:grid-cols-2 lg:max-w-2xl">
                        <TypeMultiSelect label="Что изменилось" hint="нажимайте на типы; ничего не выбрано — любой допустимый" value={focus} onChange={setFocus} />
                        <TypeMultiSelect label="Что проверяем" hint="нажимайте на типы; ничего не выбрано — любой допустимый" value={neighbor} onChange={setNeighbor} />
                      </div>
                      <TextField label="Описание" hint="необязательно: что случится, кого проверить и почему" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
                      <TextField label="Что проверить" hint="короткая просьба к проверяющему, одной фразой" value={action} onChange={(e) => setAction(e.target.value)} maxLength={200} />
                      <div>
                        <Button type="submit" variant="primary" disabled={busy || !code.trim() || title.trim().length < 3 || action.trim().length < 3}>Добавить правило</Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <RulesTable caption="Встроенные правила" rules={builtinRows} empty="" />
                )}
              </div>
            </>
          );
        }}
      </Loaded>
    </Section>
  );
}
