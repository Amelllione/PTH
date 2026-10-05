import { useState, type FormEvent } from 'react';
import type { ImportMode } from '@/entities/pth/types';
import { Button, InlineAlert, TextField, TextareaField } from '@/shared/ui';

export interface ImportFormProps {
  busy?: boolean;
  error?: string | null;
  /** dry_run — предпросмотр; changeset — черновик; apply — записать сразу. */
  onSubmit: (input: { sourceName: string; text: string }, mode: ImportMode) => void;
}

/** Загрузка спеки: файл или вставка текста. Без предпросмотра применить нельзя. */
export function ImportForm({ busy = false, error = null, onSubmit }: ImportFormProps) {
  const [sourceName, setSourceName] = useState('');
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const canSubmit = text.trim().length > 0 && sourceName.trim().length > 0 && !busy;

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10_000_000) {
      setFileError('Файл больше 10 МБ: сервер его не примет.');
      return;
    }
    setFileError(null);
    setSourceName(file.name);
    setText(await file.text());
  };

  const submit = (event: FormEvent, mode: ImportMode) => {
    event.preventDefault();
    if (canSubmit) onSubmit({ sourceName: sourceName.trim(), text }, mode);
  };

  return (
    <form className="flex flex-col gap-3" aria-label="Загрузка спецификации" onSubmit={(e) => submit(e, 'dry_run')}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-ui text-text">
          Файл спецификации (.md, .txt)
          <input
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={(e) => void loadFile(e.target.files?.[0])}
            className="text-ui file:mr-3 file:rounded-control file:border file:border-control-border file:bg-surface file:px-3 file:py-1.5 file:text-text"
          />
        </label>
        <TextField
          label="Имя источника"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          maxLength={200}
          className="w-80"
        />
      </div>
      {fileError && <InlineAlert tone="danger" message={fileError} />}
      <TextareaField
        label="Или вставьте markdown"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="font-mono"
      />
      {error && <InlineAlert tone="danger" message={error} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={!canSubmit} loading={busy}>
          Проверить без записи
        </Button>
        <Button variant="secondary" disabled={!canSubmit} onClick={(e) => submit(e, 'changeset')}>
          Создать черновик ChangeSet
        </Button>
        <Button variant="primary" disabled={!canSubmit} onClick={(e) => submit(e, 'apply')}>
          Применить сразу
        </Button>
      </div>
    </form>
  );
}
