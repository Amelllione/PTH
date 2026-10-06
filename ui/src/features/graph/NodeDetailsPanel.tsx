import { RevisionHistory } from '@/features/screens/RevisionHistory';
import type { ArtifactDetail, GraphEdge, LostReason, RevisionItem } from '@/entities/pth/types';
import { REASON_LABEL } from '@/entities/pth/types';
import { Badge, Button, EmptyState, ErrorState, InlineAlert, Skeleton } from '@/shared/ui';
import { CopyId } from '@/shared/ui/CopyId';

export interface NodeRelation {
  direction: 'out' | 'in';
  type: GraphEdge['type'];
  displayId: string;
}

export interface NodeDetailsPanelProps {
  detail: ArtifactDetail | null;
  relations: NodeRelation[];
  loading?: boolean;
  error?: string | null;
  lostReasons?: LostReason[];
  revisions?: RevisionItem[] | null;
  onFocus: (displayId: string) => void;
  onOpenRelation: (displayId: string) => void;
}

/** Панель деталей выбранного узла. Данные приходят снаружи: панель ничего не загружает сама. */
export function NodeDetailsPanel({
  detail,
  relations,
  loading = false,
  error = null,
  lostReasons = [],
  revisions = null,
  onFocus,
  onOpenRelation,
}: NodeDetailsPanelProps) {
  if (error) return <ErrorState title="Не удалось загрузить узел" description={error} />;
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загрузка деталей">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (!detail) {
    return <EmptyState title="Узел не выбран" description="Выберите узел графа, чтобы увидеть текст, ревизию и связи." />;
  }

  return (
    <article aria-labelledby="node-title" className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={detail.type} tone="accent" />
          <CopyId value={detail.display_id} className="font-mono text-meta text-text-muted">{detail.display_id}</CopyId>
          <span className="text-meta text-text-muted">ревизия {detail.revision}</span>
        </div>
        <h2 id="node-title" className="text-section font-semibold text-text">
          {detail.title}
        </h2>
      </header>

      {lostReasons.includes('no_reflection') && <InlineAlert tone="warning" message={REASON_LABEL.no_reflection} />}
      {lostReasons.includes('no_code_link') && <InlineAlert tone="info" message={REASON_LABEL.no_code_link} />}
      {detail.exemption_reason && (
        <InlineAlert tone="info" message={`Исключение из проверки: ${detail.exemption_reason}`} />
      )}

      {detail.text && <p className="whitespace-pre-wrap text-ui text-text">{detail.text}</p>}

      {Object.keys(detail.attributes).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
          {Object.entries(detail.attributes).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-text-muted">{key}</dt>
              <dd className="text-text">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-label="Связи узла" className="flex flex-col gap-2">
        <h3 className="text-ui font-semibold text-text">Связи в подграфе</h3>
        {relations.length === 0 ? (
          <p className="text-ui text-text-muted">Связей в текущем подграфе нет.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {relations.map((rel) => (
              <li key={`${rel.direction}:${rel.type}:${rel.displayId}`}>
                <button
                  type="button"
                  onClick={() => onOpenRelation(rel.displayId)}
                  className="flex w-full items-center gap-2 rounded-control px-2 py-1 text-left hover:bg-surface-muted"
                >
                  <span className="text-meta text-text-muted">{rel.direction === 'out' ? '→' : '←'}</span>
                  <Badge label={rel.type} />
                  <CopyId value={rel.displayId} className="font-mono text-meta text-text">{rel.displayId}</CopyId>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revisions && revisions.length > 0 && (
        <section aria-label="История ревизий" className="flex flex-col gap-2">
          <h3 className="text-ui font-semibold text-text">История ревизий</h3>
          <RevisionHistory revs={revisions} />
        </section>
      )}

      <Button variant="primary" onClick={() => onFocus(detail.display_id)} className="self-start">
        Сделать центром графа
      </Button>
    </article>
  );
}
