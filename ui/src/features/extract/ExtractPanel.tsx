import { useState, type FormEvent } from 'react';
import type { ExtractionJob, Proposal } from '@/entities/pth/types';
import { Badge, Button, EmptyState, ErrorState, InlineAlert, SkeletonList, TextareaField } from '@/shared/ui';

export interface ExtractPanelProps {
  models: string[] | null;
  modelsLoading: boolean;
  modelsError: string | null;
  onRetryModels: () => void;
  onExtract: (model: string, text: string) => void;
  extracting: boolean;
  extractError: string | null;
  result: { proposals: Proposal[]; skipped: number; model: string } | null;
  onCreateDraft: (title: string, proposals: Proposal[]) => void;
  creating: boolean;
  /** Режим «весь документ»: запуск фоновой задачи и её прогресс. */
  onStartJob: (model: string, sourceName: string, text: string) => void;
  job: ExtractionJob | null;
}

/**
 * Выделение требований моделью из LM Studio. Модель только предлагает: галочки выбирают,
 * что уйдёт в черновик ChangeSet. Непроверенная цитата помечается, но не скрывается.
 */
export function ExtractPanel(props: ExtractPanelProps) {
  const { models, modelsLoading, modelsError, onRetryModels, onExtract, extracting, extractError, result, onCreateDraft, creating, onStartJob, job } = props;
  const [model, setModel] = useState('');
  const [text, setText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const jobRunning = job !== null && (job.state === 'queued' || job.state === 'running');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('Выделено моделью');
  const activeModel = model || models?.[0] || '';
  const proposals = result?.proposals ?? [];

  // при новом результате отмечаем все предложения с проверенной цитатой
  const resultKey = result ? `${result.model}:${proposals.length}` : '';
  const [lastKey, setLastKey] = useState('');
  if (resultKey !== lastKey) {
    setLastKey(resultKey);
    setPicked(new Set(proposals.map((p, i) => (p.quote_verified ? i : -1)).filter((i) => i >= 0)));
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setSourceName(file.name);
    setText(await file.text());
  };

  const submitExtract = (event: FormEvent) => {
    event.preventDefault();
    if (activeModel && text.trim()) onExtract(activeModel, text);
  };

  const toggle = (index: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const chosen = proposals.filter((_, i) => picked.has(i));

  return (
    <section aria-label="Выделение требований моделью" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <div>
        <h2 className="text-section font-semibold text-text">Выделить требования моделью</h2>
        <p className="text-ui text-text-muted">
          Модель из LM Studio предлагает требования с цитатами. Ничего не записывается, пока вы не создадите черновик и не примените его.
        </p>
      </div>

      {modelsLoading && <SkeletonList rows={1} />}
      {modelsError && (
        <ErrorState
          title="LM Studio недоступен"
          description={`${modelsError}. Запустите LM Studio, включите локальный сервер и задайте LM_API_TOKEN, если он нужен.`}
          action={<Button onClick={onRetryModels}>Повторить</Button>}
        />
      )}
      {models && models.length === 0 && (
        <EmptyState title="Моделей нет" description="Загрузите модель в LM Studio и повторите." />
      )}

      {models && models.length > 0 && (
        <form onSubmit={submitExtract} className="flex flex-col gap-3" aria-label="Запрос к модели">
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Модель
            <select
              value={activeModel}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full max-w-md rounded-control border border-control-border bg-surface px-2 text-ui text-text"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Файл спецификации целиком (.md, .txt)
            <input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={(e) => void loadFile(e.target.files?.[0])} className="text-ui file:mr-3 file:rounded-control file:border file:border-control-border file:bg-surface file:px-3 file:py-1.5 file:text-text" />
          </label>
          <TextareaField label="Текст спецификации" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="font-mono" />
          {extractError && <InlineAlert tone="danger" message={extractError} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={!activeModel || !text.trim() || extracting || jobRunning} loading={extracting}>
              Выделить фрагмент (быстро)
            </Button>
            <Button
              variant="primary"
              disabled={!activeModel || !text.trim() || jobRunning}
              onClick={() => onStartJob(activeModel, sourceName || 'текст', text)}
            >
              Весь документ по частям
            </Button>
          </div>
          {job && (
            <div role="status" aria-live="polite" className="flex flex-col gap-1 rounded-control border border-border p-3">
              <p className="text-ui text-text">
                {job.state === 'succeeded' && 'Готово'}
                {job.state === 'failed' && 'Остановлено'}
                {jobRunning && 'Выделяю требования'}: фрагмент {job.chunks_done} из {job.chunks_total}, найдено {job.proposals.length}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-control bg-surface-muted" aria-hidden="true">
                <div className="h-full bg-primary" style={{ width: `${job.chunks_total ? (100 * job.chunks_done) / job.chunks_total : 0}%` }} />
              </div>
              {job.errors.length > 0 && (
                <ul className="text-meta text-danger-text">
                  {job.errors.slice(-5).map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </form>
      )}

      {result && proposals.length === 0 && (
        <EmptyState title="Модель не нашла требований" description={`Пропущено элементов с неверным форматом: ${result.skipped}.`} />
      )}

      {proposals.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-ui text-text">
            Предложено: {proposals.length}. Выбрано: {chosen.length}.
            {result && result.skipped > 0 && <span className="text-text-muted"> Пропущено по формату: {result.skipped}.</span>}
          </p>
          <ul className="flex flex-col gap-2" aria-label="Предложения модели">
            {proposals.map((p, i) => (
              <li key={`${p.type}-${i}`} className="flex gap-3 rounded-control border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={picked.has(i)}
                  onChange={() => toggle(i)}
                  aria-label={`Включить: ${p.title}`}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={p.type} tone="accent" />
                    <span className="text-ui font-medium text-text">{p.title}</span>
                    {!p.quote_verified && <Badge label="цитата не найдена в тексте" tone="warning" icon="alert" />}
                  </div>
                  {p.text && <p className="text-ui text-text">{p.text}</p>}
                  {p.quote && <p className="text-meta text-text-muted">Цитата: «{p.quote}»</p>}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-meta text-text-muted">
              Название черновика
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                className="h-9 w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text"
              />
            </label>
            <Button
              variant="primary"
              disabled={chosen.length === 0 || creating || !title.trim()}
              loading={creating}
              onClick={() => onCreateDraft(title.trim(), chosen)}
            >
              Создать черновик из {chosen.length}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
