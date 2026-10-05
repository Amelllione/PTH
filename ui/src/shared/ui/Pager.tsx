import { Button } from './Button';

export interface PagerProps {
  /** Номер страницы с нуля. */
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  label?: string;
}

export const PAGE_SIZES = [20, 50, 100, 200];

/** Пагинация списков: «назад/вперёд», номер страницы и размер страницы. */
export function Pager({ page, pageSize, total, onPage, onPageSize, label = 'Страницы' }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3 text-ui">
      <span className="text-text-muted">{total === 0 ? 'Нет записей' : `${from}–${to} из ${total}`}</span>
      <Button size="sm" variant="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>Назад</Button>
      <span>стр. {page + 1} из {pages}</span>
      <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Дальше</Button>
      {onPageSize && (
        <label className="flex items-center gap-1 text-meta text-text-muted">
          по
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-control border border-control-border bg-surface px-1 text-ui text-text">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
    </nav>
  );
}
