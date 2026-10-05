import { useState } from 'react';
import type { ChangeSet } from '@/entities/pth/types';
import { Badge, Button, EmptyState, InlineAlert, TextareaField } from '@/shared/ui';

export interface ChangeSetListProps {
  items: ChangeSet[];
  applyingUid: string | null;
  onApply: (uid: string) => void;
  /** Сохранение операций черновика; ошибки поднимаются в интерфейс. */
  onSave?: (uid: string, operations: Record<string, unknown>[]) => Promise<void>;
}

/** Черновики ChangeSet: правятся, пока не применены; применяются целиком. Ошибка применения видна. */
export function ChangeSetList({ items, applyingUid, onApply, onSave }: ChangeSetListProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (items.length === 0) {
    return <EmptyState title="Черновиков нет" description="Создайте черновик из спецификации, чтобы проверить его перед записью." />;
  }

  const startEdit = (cs: ChangeSet) => {
    setEditing(cs.uid);
    setText(JSON.stringify(cs.operations, null, 2));
    setError(null);
  };

  const save = async () => {
    setError(null);
    let ops: unknown;
    try {
      ops = JSON.parse(text);
    } catch {
      setError('Это не JSON. Проверьте скобки и кавычки.');
      return;
    }
    if (!Array.isArray(ops) || ops.length === 0 || !ops.every((o) => o && typeof o === 'object' && !Array.isArray(o))) {
      setError('Ожидается непустой список операций-объектов.');
      return;
    }
    if (!editing || !onSave) return;
    setSaving(true);
    try {
      await onSave(editing, ops as Record<string, unknown>[]);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ul className="flex flex-col gap-2" aria-label="Черновики ChangeSet">
      {[...items].reverse().map((cs) => (
        <li key={cs.uid} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-ui font-medium text-text">{cs.title}</span>
            <Badge label={cs.state === 'draft' ? 'черновик' : 'применён'} tone={cs.state === 'draft' ? 'warning' : 'success'} />
            <span className="text-meta text-text-muted">операций: {cs.operation_count}</span>
            {cs.state === 'draft' && onSave && editing !== cs.uid && (
              <Button size="sm" variant="secondary" onClick={() => startEdit(cs)}>Редактировать</Button>
            )}
            {cs.state === 'draft' && (
              <Button size="sm" variant="primary" loading={applyingUid === cs.uid} onClick={() => onApply(cs.uid)}>
                Применить
              </Button>
            )}
          </div>
          {editing === cs.uid && (
            <div className="flex flex-col gap-2">
              <TextareaField label="Операции (JSON)" value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono" />
              {error && <InlineAlert tone="danger" message={error} />}
              <div className="flex gap-2">
                <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>Сохранить</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
              </div>
            </div>
          )}
          {cs.last_error && (
            <p role="alert" className="text-meta text-danger-text">Не применён: {cs.last_error}. Данные не изменены.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
