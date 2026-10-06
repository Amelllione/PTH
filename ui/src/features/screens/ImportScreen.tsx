import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, Tabs } from '@/shared/ui';
import { ArtifactCard } from './ArtifactCard';
import { DataTable, Loaded, StatusText, usePaged } from './common';
import type { ImportReport } from '@/entities/pth/types';
import { ImportWizard } from '@/features/import/ImportWizard';
import { ImportReportView } from '@/features/import/ImportReportView';

type ITab = 'new' | 'journal';

/** Импорт: мастер «источник → проверка → черновик», журнал импортов. */
export function ImportScreen({ projectKey }: { projectKey: string }) {
  const [tab, setTab] = useState<ITab>('new');
  const [done, setDone] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <Tabs label="Разделы импорта" idPrefix="import" selectedId={tab} onChange={(id) => setTab(id as ITab)}
        items={[{ id: 'new', label: 'Новый импорт' }, { id: 'journal', label: 'Журнал' }]} />
      <div role="tabpanel" id={`import-panel-${tab}`} aria-labelledby={`import-tab-${tab}`} className="flex flex-col gap-4">
        {done && (
          <InlineAlert tone="success" message={done} />
        )}
        {tab === 'new' && <ImportWizard key={`${projectKey}:${version}`} projectKey={projectKey} onDone={(m) => { setDone(m); setVersion((v) => v + 1); }} />}
        {tab === 'journal' && <Journal projectKey={projectKey} version={version} />}
      </div>
    </div>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Журнал применённых импортов: таблица от новых к старым, нажатие открывает отчёт отдельным видом с кнопкой возврата. */
function Journal({ projectKey, version }: { projectKey: string; version: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const journal = useAsync(`imports:${projectKey}:${version}`, async () => (await pthApi.importsPage(projectKey, 0, 500)).items);
  if (open) return <JournalEntry projectKey={projectKey} uid={open} onBack={() => setOpen(null)} />;
  return (
    <section aria-label="Журнал импортов" className="flex flex-col gap-3">
      <p className="max-w-prose text-ui text-text-muted">Импорты, которые уже применены к проекту. Нажмите на строку, чтобы увидеть отчёт и исходный текст. Предпросмотры и черновики сюда не попадают: черновики лежат в разделе «Изменения».</p>
      <Loaded state={journal} retry={journal.reload} empty={{ title: 'Импортов пока нет', description: 'Загрузите спецификацию на вкладке «Новый импорт» и примените её.', isEmpty: (d) => d.length === 0 }}>
        {(items) => <JournalTable items={[...items].sort((a, b) => b.created_at.localeCompare(a.created_at))} onOpen={setOpen} />}
      </Loaded>
    </section>
  );
}

function JournalTable({ items, onOpen }: { items: ImportReport[]; onOpen: (uid: string) => void }) {
  const paged = usePaged(items, 20, 'Страницы импортов');
  const num = (n: number, tone: 'ok' | 'warn' | 'bad' | 'neutral') => (n === 0 ? <span className="text-text-muted">0</span> : <StatusText label={String(n)} tone={tone} />);
  return (
    <DataTable caption="Журнал импортов" columns="minmax(0,1.6fr) 10rem 5.5rem 5.5rem 6.5rem 5rem 6.5rem"
      headers={['Источник', 'Когда', 'Создано', 'Изменено', 'Без правок', 'Связи', 'Не разобрано']}
      onRowSelect={(i) => { const uid = paged.rows[i].uid; if (uid) onOpen(uid); }} footer={paged.pager}
      rows={paged.rows.map((r) => [
        <span key="n" className="truncate font-medium text-text">{r.source_name}</span>,
        <span key="d" className="text-meta text-text-muted">{fmt(r.created_at)}</span>,
        num(r.created, 'ok'), num(r.revised, 'warn'), <span key="u" className="text-text-muted">{r.unchanged}</span>,
        <span key="l" className="text-text-muted">{r.relations_created}</span>, num(r.unparsed.length, 'bad'),
      ])} />
  );
}

function JournalEntry({ projectKey, uid, onBack }: { projectKey: string; uid: string; onBack: () => void }) {
  const detail = useAsync(`import:${projectKey}:${uid}`, () => pthApi.importDetail(projectKey, uid));
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>Назад к отчёту импорта</Button></div>
        <ArtifactCard key={openId} projectKey={projectKey} displayId={openId} onOpen={setOpenId} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="secondary" size="sm" onClick={onBack}>Назад к журналу</Button></div>
      <Loaded state={detail} retry={detail.reload}>
        {(d) => (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-section font-semibold text-text">{d.source_name}</h2>
              <p className="text-ui text-text-muted">Применён {fmt(d.created_at)}</p>
            </div>
            <ImportReportView report={d} onOpenArtifact={setOpenId} />
            <details className="rounded-card border border-border bg-surface p-3">
              <summary className="cursor-pointer text-ui font-medium text-text">Исходный текст ({d.source_text.split('\n').length} строк)</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-meta text-text">{d.source_text}</pre>
            </details>
          </>
        )}
      </Loaded>
    </div>
  );
}
