import type { ReactNode } from 'react';
import type { ArtifactType, LostItem } from '@/entities/pth/types';
import { REASON_LABEL } from '@/entities/pth/types';
import { Button, EmptyState } from '@/shared/ui';
import { DataTable } from '@/features/screens/common';
import { CopyId } from '@/shared/ui/CopyId';

export const TYPE_FILTERS: ('ALL' | ArtifactType)[] = ['ALL', 'US', 'FR', 'NFR', 'AC'];
export const PRIORITY_FILTERS = ['ALL', 'P0', 'P1', 'P2', 'P3'] as const;
export type PriorityFilter = (typeof PRIORITY_FILTERS)[number];

export interface LostRequirementsListProps {
  items: LostItem[];
  excluded?: string[];
  typeFilter: 'ALL' | ArtifactType;
  onTypeChange: (type: 'ALL' | ArtifactType) => void;
  priorityFilter?: PriorityFilter;
  onPriorityChange?: (priority: PriorityFilter) => void;
  /** Вид: потерянные (нет отражения) или не реализованные (нет связи с кодом). */
  reasonFilter?: 'no_code_link' | 'no_reflection';
  onReasonChange?: (reason: 'no_code_link' | 'no_reflection') => void;
  /** Открыть элемент на графе. */
  onOpen: (displayId: string) => void;
  /** Нижняя полоса списка, обычно пагинация. */
  footer?: ReactNode;
}

/** Список потерянных элементов: причина, приоритет и рекомендуемое действие рядом с ID. */
export function LostRequirementsList({
  items,
  excluded = [],
  typeFilter,
  onTypeChange,
  priorityFilter = 'ALL',
  onPriorityChange,
  reasonFilter = 'no_reflection',
  onReasonChange,
  onOpen,
  footer,
}: LostRequirementsListProps) {
  return (
    <section aria-label="Потерянные элементы" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Фильтр по типу" className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={type === typeFilter ? 'primary' : 'secondary'}
              aria-pressed={type === typeFilter}
              onClick={() => onTypeChange(type)}
            >
              {type === 'ALL' ? 'Все' : type}
            </Button>
          ))}
        </div>
        {onReasonChange && (
          <div role="group" aria-label="Вид" className="flex flex-wrap gap-2">
            {([
              ['no_reflection', 'Потерянные: нет отражения в ФТ или ADR'],
              ['no_code_link', 'Не реализованы: нет связи с кодом'],
            ] as const).map(([value, label]) => (
              <Button key={value} size="sm" variant={value === reasonFilter ? 'primary' : 'secondary'}
                aria-pressed={value === reasonFilter} onClick={() => onReasonChange(value)}>
                {label}
              </Button>
            ))}
          </div>
        )}
        {onPriorityChange && (
          <div role="group" aria-label="Фильтр по приоритету" className="flex flex-wrap gap-2">
            {PRIORITY_FILTERS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === priorityFilter ? 'primary' : 'secondary'}
                aria-pressed={p === priorityFilter}
                onClick={() => onPriorityChange(p)}
              >
                {p === 'ALL' ? 'Любой приоритет' : p}
              </Button>
            ))}
          </div>
        )}
        <span className="text-meta text-text-muted">
          Исключено обоснованно: {excluded.length}
          {excluded.length > 0 && ` (${excluded.join(', ')})`}
        </span>
      </div>

      <p className="text-meta text-text-muted">
        {reasonFilter === 'no_reflection'
          ? 'Потерянные — user story без ФТ или ADR. Не реализованные — требования без связи implements с коммитом; это отдельный вид, не потеря.'
          : 'Не реализованные — FR, NFR или AC без связи implements. Потерянными они не считаются.'}
      </p>

      {items.length === 0 ? (
        <EmptyState
          title={reasonFilter === 'no_reflection' ? 'Потерянных элементов нет' : 'Нереализованных элементов нет'}
          description={reasonFilter === 'no_reflection' ? 'Каждая user story отражена в ФТ или ADR.' : 'Все требования связаны с коммитом.'}
        />
      ) : (
        <DataTable
          caption={`Потерянные элементы: ${items.length}`}
          footer={footer}
          columns="7.5rem minmax(0,1fr) 5.5rem minmax(0,1fr) minmax(0,1.2fr)"
          headers={['ID', 'Название', 'Приоритет', 'Причина', 'Что сделать']}
          rows={items.map((item) => [
            <CopyId key="id" value={item.display_id}>
              <button
                type="button"
                onClick={() => onOpen(item.display_id)}
                className="font-mono text-meta font-medium text-accent-text underline-offset-2 hover:underline"
              >
                {item.display_id}
              </button>
            </CopyId>,
            item.title,
            <span key="p" className={item.priority === 'P0' ? 'font-semibold text-danger-text' : 'text-text-muted'}>
              {item.priority ?? '—'}
            </span>,
            <span key="r" className="flex flex-col gap-0.5">
              {item.reasons.map((reason) => (
                <span key={reason} className="text-text">{REASON_LABEL[reason]}</span>
              ))}
            </span>,
            <span key="a" className="flex flex-col gap-0.5 text-text-muted">
              <span>{item.recommended_action}</span>
              {item.last_commit && <span className="font-mono text-meta">коммит: {item.last_commit}</span>}
            </span>,
          ])}
        />
      )}
    </section>
  );
}
