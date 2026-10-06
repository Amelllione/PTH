import { useEffect, useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, TextareaField, TextField } from '@/shared/ui';
import { DraftReview } from './DraftReview';
import { itemsFromPreview, itemsFromProposals, type DraftItem, type DraftLink } from './draft';
import type { ExtractionJob } from '@/entities/pth/types';

const EXAMPLE = `| ID | Требование | Основание |
| --- | --- | --- |
| SHOP-US-001 | Как покупатель, хочу собрать корзину | |
| SHOP-FR-001 | Корзина хранит выбранные товары | SHOP-US-001 |
| SHOP-FR-002 | Корзина считает итоговую сумму | SHOP-US-001 |
`;
const EXAMPLE_US = `| ID | Как..., хочу... | Цель | Приоритет |
| --- | --- | --- | --- |
| SHOP-US-001 | Как покупатель, хочу собрать корзину | Оформить заказ | P0 |
`;

type Method = 'table' | 'llm';
type Review = { items: DraftItem[]; links: DraftLink[]; unparsed: string[]; text: string; name: string; origin: Method };

/** Импорт в два шага: источник и проверка. Что и как будет создано, видно до записи; элементы и связи правятся в предпросмотре. */
export function ImportWizard({ projectKey, onDone }: { projectKey: string; onDone: (message: string) => void }) {
  const [method, setMethod] = useState<Method>('table');
  const [sourceName, setSourceName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [model, setModel] = useState('');
  const models = useAsync(method === 'llm' ? `wizard-models:${projectKey}` : null, () => pthApi.llmModels());
  const activeModel = model || models.data?.[0] || '';
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const jobRunning = job !== null && (job.state === 'queued' || job.state === 'running');
  const name = sourceName.trim() || (method === 'table' ? 'вставленный текст.md' : 'текст');

  // Фоновая обработка всего документа: опрос раз в 2 секунды, результат уходит в проверку.
  useEffect(() => {
    if (!job || !jobRunning) return undefined;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const current = await pthApi.job(projectKey, job.uid);
        if (stopped) return;
        setJob(current);
        if (current.state === 'succeeded' || current.state === 'failed') {
          stopped = true;
          clearInterval(timer);
          if (current.proposals.length > 0) setReview({ items: itemsFromProposals(current.proposals, text), links: [], unparsed: [], text, name, origin: 'llm' });
          else setError(current.state === 'failed' ? `Обработка остановлена: ${current.errors.slice(-1)[0] ?? 'ошибка'}` : 'Модель не нашла требований в тексте.');
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'Нет связи с сервером');
      }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [job?.uid, jobRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setSourceName(file.name);
    setText(await file.text());
  };

  const previewTable = async () => {
    setBusy(true); setError(null);
    try {
      const prev = await pthApi.importPreview(projectKey, { source_name: name, text });
      if (prev.items.length === 0) {
        setError(prev.unparsed.length ? `Ни одна строка не разобрана. Пример нераспознанной: ${prev.unparsed[0]}` : 'В тексте нет таблиц с колонкой «ID» в первой колонке: смотрите «Как читается текст» справа.');
        return;
      }
      const { items, links } = itemsFromPreview(prev);
      setReview({ items, links, unparsed: prev.unparsed, text, name, origin: 'table' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разобрать текст');
    } finally { setBusy(false); }
  };

  const extractQuick = async () => {
    setBusy(true); setError(null);
    try {
      const r = await pthApi.extract(projectKey, activeModel, text);
      if (r.proposals.length === 0) { setError(`Модель не нашла требований. Пропущено по формату: ${r.skipped}.`); return; }
      setReview({ items: itemsFromProposals(r.proposals, text), links: [], unparsed: [], text, name, origin: 'llm' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выделить требования');
    } finally { setBusy(false); }
  };

  const extractAll = async () => {
    setError(null);
    try { setJob(await pthApi.startJob(projectKey, { model: activeModel, source_name: name, text })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось запустить выделение'); }
  };

  if (review) {
    return (
      <DraftReview projectKey={projectKey} sourceName={review.name} text={review.text} initialItems={review.items} initialLinks={review.links}
        unparsed={review.unparsed} origin={review.origin} onBack={() => setReview(null)}
        onDone={(message) => { setReview(null); setText(''); setSourceName(''); setJob(null); onDone(message); }} />
    );
  }
  const card = (m: Method, title: string, hint: string) => (
    <button type="button" aria-pressed={method === m} onClick={() => { setMethod(m); setError(null); }}
      className={`flex flex-col gap-1 rounded-card border p-4 text-left ${method === m ? 'border-accent-text bg-accent-soft/40' : 'border-border bg-surface hover:bg-surface-muted/60'}`}>
      <span className="text-ui font-semibold text-text">{title}</span>
      <span className="text-meta text-text-muted">{hint}</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-meta text-text-muted" aria-label="Шаги импорта">
        <li className="font-semibold text-text">1. Источник</li><li>2. Проверка и правка</li><li>3. Черновик или применение</li>
      </ol>
      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="Способ">
        {card('table', 'Таблицы Markdown', 'Текст уже оформлен таблицами с ID. Элементы берутся из строк точно, как написано.')}
        {card('llm', 'Выделить моделью', 'Произвольный текст: заметки, письмо, описание. Модель предлагает требования и показывает фразы, на которых они основаны.')}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <TextField label="Название источника" hint="для журнала, например spec.md" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-72" />
            <label className="flex flex-col gap-1 text-meta text-text-muted">Файл .md или .txt
              <input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={(e) => void loadFile(e.target.files?.[0])} className="text-ui text-text" />
            </label>
            {method === 'table' && <Button size="sm" variant="secondary" onClick={() => { setText(EXAMPLE); setSourceName('пример.md'); }}>Вставить пример</Button>}
          </div>
          <TextareaField label="Текст" hint={method === 'table' ? 'вставьте Markdown с таблицами' : 'вставьте текст в любом виде'} value={text} onChange={(e) => setText(e.target.value)} rows={16} className="font-mono" />
          <p className="text-meta text-text-muted">{text.length} знаков, строк: {text ? text.split('\n').length : 0}</p>
          {error && <InlineAlert tone="danger" message={error} />}
          {method === 'table' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={!text.trim() || busy} loading={busy} onClick={() => void previewTable()}>Показать, что будет создано</Button>
              <span className="text-meta text-text-muted">Пока ничего не записывается: сначала предпросмотр.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-meta text-text-muted">Модель (LM Studio)
                  <select value={activeModel} onChange={(e) => setModel(e.target.value)} className="h-9 min-w-64 rounded-control border border-control-border bg-surface px-2 text-ui text-text" disabled={!models.data?.length}>
                    {(models.data ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                {models.error && <InlineAlert tone="danger" message={`Модели недоступны: ${models.error}. Запустите LM Studio и обновите страницу.`} />}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" disabled={!activeModel || !text.trim() || busy || jobRunning} loading={busy} onClick={() => void extractQuick()}>Выделить из фрагмента</Button>
                <Button variant="primary" disabled={!activeModel || !text.trim() || jobRunning} onClick={() => void extractAll()}>Обработать весь документ по частям</Button>
              </div>
              {job && (
                <div role="status" aria-live="polite" className="flex flex-col gap-1 rounded-control border border-border p-3">
                  <p className="text-ui text-text">{jobRunning ? 'Модель читает текст' : job.state === 'succeeded' ? 'Готово' : 'Остановлено'}: часть {job.chunks_done} из {job.chunks_total}, найдено {job.proposals.length}</p>
                  <div className="h-2 w-full overflow-hidden rounded-control bg-surface-muted" aria-hidden="true"><div className="h-full bg-primary" style={{ width: `${job.chunks_total ? (100 * job.chunks_done) / job.chunks_total : 0}%` }} /></div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-ui" aria-label="Как читается текст">
          {method === 'table' ? (
            <>
              <h3 className="font-semibold">Как читается текст</h3>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-text">
                <li>Берутся только таблицы, у которых <strong>первая колонка называется «ID»</strong>.</li>
                <li>ID вида <span className="font-mono text-meta">SHOP-FR-012</span>: средняя часть <span className="font-mono text-meta">US, FR, NFR, AC</span> задаёт тип, число в конце — номер, начало (<span className="font-mono text-meta">SHOP</span>, <span className="font-mono text-meta">PTH</span>…) любое. В проекте элемент получит свой ID с ключом проекта. Строки <span className="font-mono text-meta">DEC, SK, ADR</span> пропускаются.</li>
                <li>Вторая колонка — название. У US третья колонка — цель, четвёртая «Приоритет» (P0–P3).</li>
                <li>Последняя колонка у не-US («Основание») со ссылками на ID других строк даёт связи «уточняет».</li>
                <li>Если элемент с таким ID уже есть, а текст другой, создаётся новая ревизия; если такой же, ничего не меняется.</li>
              </ol>
              <h4 className="font-semibold">Пример</h4>
              <pre className="overflow-auto rounded-control bg-surface-muted p-3 font-mono text-meta">{EXAMPLE}</pre>
              <p className="text-meta text-text-muted">Из примера получится: 1 User story и 2 функциональных требования, у каждого ФТ связь «уточняет» с US.</p>
              <h4 className="font-semibold">Таблица с US</h4>
              <pre className="overflow-auto rounded-control bg-surface-muted p-3 font-mono text-meta">{EXAMPLE_US}</pre>
            </>
          ) : (
            <>
              <h3 className="font-semibold">Как работает выделение</h3>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-text">
                <li>Модель читает текст частями и предлагает US, ФТ, НФТ и AC: тип, название, формулировка.</li>
                <li>К каждому предложению она обязана привести <strong>дословную цитату</strong> из текста, на которой оно основано.</li>
                <li>На шаге проверки цитаты подсвечены в тексте. Предложение, цитату которого не нашли в тексте, не включается автоматически.</li>
                <li>Правьте название, тип, формулировку, связывайте элементы между собой. Цитату можно сменить: выделите фразу в тексте.</li>
                <li>Пока вы не создали черновик, в проект ничего не записывается.</li>
              </ol>
              <p className="text-meta text-text-muted">Модель только предлагает: решение, что станет требованием, остаётся за вами.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
