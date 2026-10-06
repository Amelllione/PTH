import type { ImportReport } from '@/entities/pth/types';
import { Badge, InlineAlert } from '@/shared/ui';
import { DataTable, StatusText, usePaged } from '@/features/screens/common';

export interface ImportReportViewProps {
  report: ImportReport;
  /** Переход к карточке элемента из списка изменений. Без него ID — текст. */
  onOpenArtifact?: (displayId: string) => void;
}

/** Итог импорта: счётчики, изменения по каждому ID и нераспознанные строки. Текст — не только цвет. */
export function ImportReportView({ report, onOpenArtifact }: ImportReportViewProps) {
  return (
    <section aria-label="Отчёт импорта" className="flex flex-col gap-3">
      {report.changeset_uid ? (
        <InlineAlert tone="info" message="Черновик ChangeSet создан. Данные не изменены: примените его в разделе «Изменения»." />
      ) : report.dry_run ? (
        <InlineAlert tone="info" message="Предпросмотр: данные не изменены. Нажмите «Применить сразу», чтобы записать." />
      ) : (
        <InlineAlert tone="success" message={`Импорт записан${report.uid ? `, журнал ${report.uid.slice(0, 8)}` : ''}.`} />
      )}
      <div className="flex flex-wrap gap-2">
        <Badge label={`создано: ${report.created}`} tone="success" />
        <Badge label={`изменено: ${report.revised}`} tone="warning" />
        <Badge label={`без изменений: ${report.unchanged}`} />
        <Badge label={`связей: ${report.relations_created}`} tone="info" />
        <Badge label={`нераспознано: ${report.unparsed.length}`} tone={report.unparsed.length ? 'danger' : 'neutral'} />
      </div>
      <p className="font-mono text-meta text-text-muted">sha256 {report.source_sha256.slice(0, 16)}…</p>

      {report.changes.length > 0 && <ChangesTable changes={report.changes} onOpenArtifact={onOpenArtifact} />}

      {report.unparsed.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-ui font-semibold text-text">Не распознано</h3>
          <ul className="flex flex-col gap-1 font-mono text-meta text-text-muted">
            {report.unparsed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ChangesTable({ changes, onOpenArtifact }: { changes: ImportReport['changes']; onOpenArtifact?: (displayId: string) => void }) {
  const paged = usePaged(changes, 20, 'Страницы элементов');
  return (
    <DataTable caption="Элементы, полученные из источника" columns="minmax(0,1fr) 12rem" headers={['Элемент', 'Действие']}
      onRowSelect={onOpenArtifact ? (i) => onOpenArtifact(paged.rows[i].display_id) : undefined} footer={paged.pager}
      rows={paged.rows.map((c) => [
        onOpenArtifact
          ? <span key="i" className="font-mono text-meta font-medium text-accent-text underline underline-offset-2">{c.display_id}</span>
          : <span key="i" className="font-mono text-meta">{c.display_id}</span>,
        <StatusText key="a" label={c.action === 'created' ? 'создан' : 'новая ревизия'} tone={c.action === 'created' ? 'ok' : 'warn'} />,
      ])} />
  );
}
