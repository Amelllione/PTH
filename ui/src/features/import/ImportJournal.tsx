import type { ImportReport } from '@/entities/pth/types';
import { Button, EmptyState } from '@/shared/ui';

export interface ImportJournalProps {
  items: ImportReport[];
  onOpen: (uid: string) => void;
}

/** Журнал применённых импортов. Предпросмотры в журнал не попадают. */
export function ImportJournal({ items, onOpen }: ImportJournalProps) {
  if (items.length === 0) {
    return <EmptyState title="Импортов пока нет" description="Загрузите спецификацию и нажмите «Применить»." />;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Журнал импортов">
      {[...items].reverse().map((item) => (
        <li key={item.uid ?? item.source_sha256} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-ui font-medium text-text">{item.source_name}</span>
            <span className="text-meta text-text-muted">
              {new Date(item.created_at).toLocaleString('ru-RU')} · создано {item.created}, изменено {item.revised}, без изменений {item.unchanged}
            </span>
          </div>
          {item.uid && (
            <Button size="sm" onClick={() => onOpen(item.uid as string)}>
              Открыть
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
