import type { ReactNode } from 'react';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';

/** Общая обёртка: загрузка, ошибка, пусто или содержимое. Ошибка API не скрывается. */
export function Loaded<T>({
  state,
  retry,
  empty,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean };
  retry: () => void;
  empty?: { title: string; description?: string; isEmpty?: (d: T) => boolean };
  children: (data: T) => ReactNode;
}) {
  if (state.loading && state.data === null) return <SkeletonList rows={4} />;
  if (state.error) {
    return (
      <ErrorState
        title="Не удалось загрузить список"
        description={state.error}
        action={<button type="button" className="text-ui font-medium text-accent-text underline underline-offset-2" onClick={retry}>Повторить</button>}
      />
    );
  }
  if (state.data === null) return null;
  if (empty?.isEmpty?.(state.data)) return <EmptyState title={empty.title} description={empty.description} />;
  return <>{children(state.data)}</>;
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-semibold text-text">{title}</h2>
        {hint && <p className="max-w-prose text-ui text-text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Журнал: строки без рамок и теней, разделитель — одна линия, заголовки в обычном регистре.
 * Колонки выравниваются сеткой; на узком экране журнал прокручивается по горизонтали.
 */
export function DataTable({ caption, headers, rows, footer, columns }: { caption: string; headers: string[]; rows: ReactNode[][]; footer?: ReactNode; /** CSS-шаблон колонок, например «8rem 1fr 18rem». */ columns?: string }) {
  const template = columns ?? headers.map(() => 'minmax(0, 1fr)').join(' ');
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div role="table" aria-label={caption} className="min-w-[640px] text-ui" style={{ minWidth: columns ? 'max(640px, 100%)' : undefined }}>
        <div role="row" className="grid gap-x-4 border-b border-border px-4 py-2 text-meta font-medium text-text-muted" style={{ gridTemplateColumns: template }}>
          {headers.map((h) => <div role="columnheader" key={h} className="truncate">{h}</div>)}
        </div>
        <div role="rowgroup">
          {rows.map((cells, i) => (
            <div
              role="row"
              key={i}
              className="grid items-center gap-x-4 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-muted/60"
              style={{ gridTemplateColumns: template }}
            >
              {cells.map((c, j) => <div role="cell" key={j} className="min-w-0 break-words tabular-nums">{c}</div>)}
            </div>
          ))}
        </div>
        {footer && <div className="border-t border-border bg-surface-muted/40 px-4 py-2.5">{footer}</div>}
      </div>
    </div>
  );
}

/** Статус: точка и слово. Цвет дополняет текст, а не заменяет его. */
export function StatusText({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' | 'info' }) {
  const dot = { ok: 'bg-success-text', warn: 'bg-warning-text', bad: 'bg-danger-text', neutral: 'bg-text-muted', info: 'bg-info-text' }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
