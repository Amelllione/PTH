import { useState, type FormEvent } from 'react';
import { Button, InlineAlert, TextField } from '@/shared/ui';

export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export interface CreateProjectFormProps {
  busy?: boolean;
  error?: string | null;
  onSubmit: (key: string, name: string) => void;
  onCancel: () => void;
}

/** Создание проекта: ключ — короткий ID, по которому затем импортируется спека. */
export function CreateProjectForm({ busy = false, error = null, onSubmit, onCancel }: CreateProjectFormProps) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const keyOk = PROJECT_KEY_PATTERN.test(key);
  const canSubmit = keyOk && name.trim().length > 0 && !busy;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit(key, name.trim());
  };

  return (
    <form aria-label="Новый проект" onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div>
        <h2 className="text-section font-semibold text-text">Новый проект</h2>
        <p className="text-ui text-text-muted">
          Проект — отдельный набор спек, требований и связей. Создайте его, затем импортируйте в него спецификацию.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Ключ проекта"
          hint="2–10 заглавных латинских букв и цифр, например SHOP или PTH"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          maxLength={10}
          className="w-56"
          error={key && !keyOk ? 'Начните с буквы; допустимы A–Z и 0–9, 2–10 символов' : undefined}
        />
        <TextField label="Название" hint="Для людей, например «Интернет-магазин»" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="w-80" />
      </div>
      {error && <InlineAlert tone="danger" message={error} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={busy}>Создать проект</Button>
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}
