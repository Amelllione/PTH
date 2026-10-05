import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import type { ArtifactDetail } from '@/entities/pth/types';
import { Button, InlineAlert, TextField, TextareaField } from '@/shared/ui';

type AttrRow = { key: string; value: string };

export interface Change {
  field: string;
  before: string;
  after: string;
  kind: 'changed' | 'removed' | 'added';
}

const toRows = (attrs: Record<string, unknown>): AttrRow[] =>
  Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) }));

/** Сравнивает текущую карточку с черновиком: что будет перезаписано. */
export function diffCard(current: ArtifactDetail, title: string, text: string, rows: AttrRow[], exemption: string): Change[] {
  const changes: Change[] = [];
  if (title !== current.title) changes.push({ field: 'название', before: current.title, after: title, kind: 'changed' });
  if (text !== current.text) changes.push({ field: 'текст', before: current.text, after: text, kind: 'changed' });
  const next = Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
  for (const [k, v] of Object.entries(current.attributes)) {
    if (!(k in next)) changes.push({ field: `атрибут «${k}»`, before: String(v), after: '(удалится)', kind: 'removed' });
    else if (next[k] !== String(v)) changes.push({ field: `атрибут «${k}»`, before: String(v), after: next[k], kind: 'changed' });
  }
  for (const k of Object.keys(next)) {
    if (!(k in current.attributes)) changes.push({ field: `атрибут «${k}»`, before: '—', after: next[k], kind: 'added' });
  }
  if ((exemption || '') !== (current.exemption_reason ?? '')) {
    changes.push({ field: 'исключение', before: current.exemption_reason ?? '—', after: exemption || '—', kind: 'changed' });
  }
  return changes;
}

/**
 * Правка карточки любого элемента: всё уходит черновиком. Номер ревизии ставит сервер.
 * Перед созданием черновика показываем, что будет перезаписано, и даём проверить.
 */
export function ArtifactEditor({ projectKey, card, onSaved, onCancel }: {
  projectKey: string; card: ArtifactDetail; onSaved: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [text, setText] = useState(card.text);
  const [exemption, setExemption] = useState(card.exemption_reason ?? '');
  const [rows, setRows] = useState<AttrRow[]>(toRows(card.attributes));
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [draftUid, setDraftUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = () => {
    setError(null);
    setDraftUid(null);
    setChanges(diffCard(card, title, text, rows, exemption));
  };

  const createDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const attributes = Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
      const draft = await pthApi.createChangeset(projectKey, {
        title: `Правка ${card.display_id}`,
        operations: [{ op: 'add_revision', display_id: card.display_id, title, text, attributes,
          exemption_reason: exemption.trim() || null }],
      });
      setDraftUid(draft.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать черновик');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!draftUid) return;
    setBusy(true);
    setError(null);
    try {
      await pthApi.applyChangeset(projectKey, draftUid);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось применить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4" aria-label={`Правка ${card.display_id}`}
      onSubmit={(e) => { e.preventDefault(); check(); }}>
      <TextField label="Название" value={title} onChange={(e) => { setTitle(e.target.value); setChanges(null); }} maxLength={300} className="w-full" />
      <TextareaField label="Текст" value={text} onChange={(e) => { setText(e.target.value); setChanges(null); }} rows={5} className="w-full" />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-ui font-medium text-text">Атрибуты</legend>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <TextField label="ключ" hideLabel value={row.key} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} placeholder="ключ" />
            <TextField label="значение" hideLabel value={row.value} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} placeholder="значение" />
            <button type="button" className="h-9 text-meta text-text-muted underline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>убрать</button>
          </div>
        ))}
        <div>
          <button type="button" className="text-meta font-medium text-accent-text underline" onClick={() => setRows([...rows, { key: '', value: '' }])}>добавить атрибут</button>
        </div>
      </fieldset>
      <TextField label="Исключение из проверки" hint="пусто — не исключено" value={exemption} onChange={(e) => { setExemption(e.target.value); setChanges(null); }} maxLength={500} className="w-full" />

      {changes && changes.length === 0 && <InlineAlert tone="info" message="Изменений нет: сохранять нечего." />}
      {changes && changes.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-warning-text bg-warning-soft p-3">
          <p className="text-ui font-semibold text-warning-text">
            Изменения перезапишут текущие значения. Проверьте перечисленное до применения.
          </p>
          <ul className="flex flex-col gap-1 text-ui text-text">
            {changes.map((c) => (
              <li key={c.field + c.kind}>
                <span className="font-medium">{c.field}:</span>{' '}
                <span className="text-text-muted line-through">{c.before}</span> → <span>{c.after}</span>
              </li>
            ))}
          </ul>
          {!draftUid && (
            <div>
              <Button type="button" variant="primary" disabled={busy} loading={busy} onClick={() => void createDraft()}>
                Создать черновик с этими изменениями
              </Button>
            </div>
          )}
          {draftUid && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ui text-text">Черновик создан: новая ревизия появится после применения.</span>
              <Button type="button" variant="primary" disabled={busy} loading={busy} onClick={() => void apply()}>Применить</Button>
            </div>
          )}
        </div>
      )}
      {error && <InlineAlert tone="danger" message={error} />}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary">Проверить изменения</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}
