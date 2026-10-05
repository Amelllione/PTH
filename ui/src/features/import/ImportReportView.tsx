import type { ImportReport } from '@/entities/pth/types';
import { Badge, InlineAlert } from '@/shared/ui';

export interface ImportReportViewProps {
  report: ImportReport;
}

/** Итог импорта: счётчики, изменения по каждому ID и нераспознанные строки. Текст — не только цвет. */
export function ImportReportView({ report }: ImportReportViewProps) {
  return (
    <section aria-label="Отчёт импорта" className="flex flex-col gap-3">
      {report.changeset_uid ? (
        <InlineAlert tone="info" message="Черновик ChangeSet создан. Данные не изменены: примените его в разделе «Черновики»." />
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

      {report.changes.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[320px] text-left text-ui">
            <caption className="sr-only">Изменения по элементам</caption>
            <thead className="bg-surface-muted text-meta text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">ID</th>
                <th scope="col" className="px-3 py-2 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              {report.changes.map((c) => (
                <tr key={c.display_id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-meta">{c.display_id}</td>
                  <td className="px-3 py-2">{c.action === 'created' ? 'создан' : 'новая ревизия'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
